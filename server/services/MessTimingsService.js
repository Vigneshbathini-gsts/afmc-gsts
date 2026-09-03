const db = require("../config/db");
const MessTimingsModel = require("../models/MessTimingsModel");

let cachedTimings = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5000;

const getWeeklyTimings = async ({ forceRefresh = false } = {}) => {
  const now = Date.now();

  if (!forceRefresh && cachedTimings && now - cachedAt < CACHE_TTL_MS) {
    return cachedTimings;
  }

  cachedTimings = await MessTimingsModel.getWeeklyTimings();
  cachedAt = now;

  return cachedTimings;
};

const DAYS = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

const BUSINESS_TIME_ZONE = "Asia/Kolkata";

const getBusinessDateParts = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    calendar: "gregory",
    numberingSystem: "latn",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value])
  );

  return {
    dayName: values.weekday.toUpperCase(),
    currentMinutes: Number(values.hour) * 60 + Number(values.minute),
  };
};

const parseTimeToMinutes = (value) => {
  const match = String(value ?? "").trim().match(
    /^(\d{1,2}):(\d{2})(?::\d{2})?$/
  );

  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) return null;

  return hours * 60 + minutes;
};

const isCurrentTimeBetween = (from, to, nowMinutes) => {
  if (from === null || to === null || from === to) return false;

  if (from < to) {
    return nowMinutes >= from && nowMinutes <= to;
  }

  return nowMinutes >= from || nowMinutes <= to;
};

const isOvernightShiftOpenFromPreviousDay = (from, to, nowMinutes) => {
  if (from === null || to === null || from <= to) return false;

  return nowMinutes <= to;
};

const getShiftValues = (dayTiming, shiftNumber) => ({
  open: parseTimeToMinutes(dayTiming[`shift${shiftNumber}_open_time`]),
  close: parseTimeToMinutes(dayTiming[`shift${shiftNumber}_close_time`]),
});

const isMessOpen = async ({ forceRefresh = false } = {}) => {
  const timings = await getWeeklyTimings({ forceRefresh });

  const { dayName: today, currentMinutes } = getBusinessDateParts();
  const todayIndex = DAYS.indexOf(today);
  const previousDay = DAYS[(todayIndex + 6) % 7];

  const candidateDays = [today, previousDay];

  for (const [dayIndex, dayName] of candidateDays.entries()) {
    const dayTiming = timings.find(
      (row) => String(row.day_name).trim().toUpperCase() === dayName
    );

    if (!dayTiming || String(dayTiming.active_flag).trim().toUpperCase() !== "Y") {
      continue;
    }

    const shift1 = getShiftValues(dayTiming, 1);
    const shift2 = getShiftValues(dayTiming, 2);

    const isOpenToday =
      isCurrentTimeBetween(shift1.open, shift1.close, currentMinutes) ||
      isCurrentTimeBetween(shift2.open, shift2.close, currentMinutes) ||
      (shift1.open > shift1.close && currentMinutes >= shift1.open) ||
      (shift2.open > shift2.close && currentMinutes >= shift2.open);
    const isOpenFromPreviousDay =
      dayIndex === 1 &&
      (isOvernightShiftOpenFromPreviousDay(shift1.open, shift1.close, currentMinutes) ||
        isOvernightShiftOpenFromPreviousDay(shift2.open, shift2.close, currentMinutes));

    if ((isOpenToday && dayIndex === 0) || isOpenFromPreviousDay) {
      return true;
    }
  }

  return false;
};

const updateWeeklyTimings = async ({ timings, updatedBy }) => {
  if (!Array.isArray(timings) || timings.length !== 7) {
    throw new Error("Seven day timings are required.");
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    for (const day of timings) {
      const activeFlag = String(day.active_flag ?? "N").trim().toUpperCase();
      const shift1OpenValue = String(day.shift1_open_time ?? "").trim() || null;
      const shift1CloseValue = String(day.shift1_close_time ?? "").trim() || null;
      const shift2OpenValue = String(day.shift2_open_time ?? "").trim() || null;
      const shift2CloseValue = String(day.shift2_close_time ?? "").trim() || null;
      const shift1Open = parseTimeToMinutes(shift1OpenValue);
      const shift1Close = parseTimeToMinutes(shift1CloseValue);
      const shift2Open = parseTimeToMinutes(shift2OpenValue);
      const shift2Close = parseTimeToMinutes(shift2CloseValue);
      const hasShift1 = Boolean(shift1OpenValue && shift1CloseValue);
      const hasShift2 = Boolean(shift2OpenValue && shift2CloseValue);

      if (!['Y', 'N'].includes(activeFlag)) {
        throw new Error(`${day.day_name}: Active flag must be Y or N.`);
      }

      if ((shift1OpenValue && shift1Open === null) ||
        (shift1CloseValue && shift1Close === null) ||
        (shift2OpenValue && shift2Open === null) ||
        (shift2CloseValue && shift2Close === null)) {
        throw new Error(`${day.day_name}: Timings must use valid HH:mm values.`);
      }

      if ((shift1Open !== null && shift1Close !== null && shift1Open === shift1Close) ||
        (shift2Open !== null && shift2Close !== null && shift2Open === shift2Close)) {
        throw new Error(`${day.day_name}: Opening and closing times cannot be the same.`);
      }

      if (activeFlag === "Y") {
        if (!hasShift1 && !hasShift2) {
          throw new Error(`${day.day_name}: Please set at least one complete shift before marking it active.`);
        }

        if ((day.shift1_open_time && !day.shift1_close_time) || (!day.shift1_open_time && day.shift1_close_time)) {
          throw new Error(`${day.day_name}: Shift 1 must have both start and end time.`);
        }

        if ((day.shift2_open_time && !day.shift2_close_time) || (!day.shift2_open_time && day.shift2_close_time)) {
          throw new Error(`${day.day_name}: Shift 2 must have both start and end time.`);
        }
      }

      await connection.execute(
        `
        UPDATE xxafmc_mess_timings_week
        SET
          shift1_open_time=?,
          shift1_close_time=?,
          shift2_open_time=?,
          shift2_close_time=?,
          active_flag=?,
          updated_by=?,
          updated_on=NOW()
          WHERE id = ?
        `,
        [
          shift1OpenValue,
          shift1CloseValue,
          shift2OpenValue,
          shift2CloseValue,
          activeFlag,
          updatedBy,
          day.id,
        ]
      );

    }

    await connection.commit();

    cachedTimings = await MessTimingsModel.getWeeklyTimings();
    cachedAt = Date.now();

    return cachedTimings;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  getWeeklyTimings,
  updateWeeklyTimings,
  isMessOpen,
};
