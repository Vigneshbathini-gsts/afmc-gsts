const db = require("../config/db");
const MessTimingsModel = require("../models/MessTimingsModel");

let cachedTimings = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5000;

const getWeeklyTimings = async () => {
  const now = Date.now();

  if (cachedTimings && now - cachedAt < CACHE_TTL_MS) {
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
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: BUSINESS_TIME_ZONE,
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
  if (!value) return null;

  const [hours, minutes] = String(value)
    .split(":")
    .map((part) => Number(part));

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  return hours * 60 + minutes;
};

const isCurrentTimeBetween = (from, to, nowMinutes) => {
  if (from === null || to === null) return false;

  if (from < to) {
    return nowMinutes >= from && nowMinutes <= to;
  }

  return nowMinutes >= from || nowMinutes <= to;
};

const isOvernightShiftOpenFromPreviousDay = (from, to, nowMinutes) => {
  if (from === null || to === null || from <= to) return false;

  return nowMinutes <= to;
};

const isMessOpen = async () => {
  const timings = await MessTimingsModel.getWeeklyTimings();

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

    const shift1Open = parseTimeToMinutes(dayTiming.shift1_open_time);
    const shift1Close = parseTimeToMinutes(dayTiming.shift1_close_time);
    const shift2Open = parseTimeToMinutes(dayTiming.shift2_open_time);
    const shift2Close = parseTimeToMinutes(dayTiming.shift2_close_time);

    const isOpenToday =
      isCurrentTimeBetween(shift1Open, shift1Close, currentMinutes) ||
      isCurrentTimeBetween(shift2Open, shift2Close, currentMinutes);
    const isOpenFromPreviousDay =
      dayIndex === 1 &&
      (isOvernightShiftOpenFromPreviousDay(shift1Open, shift1Close, currentMinutes) ||
        isOvernightShiftOpenFromPreviousDay(shift2Open, shift2Close, currentMinutes));

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
      const hasShift1 = Boolean(day.shift1_open_time && day.shift1_close_time);
      const hasShift2 = Boolean(day.shift2_open_time && day.shift2_close_time);

      if (day.active_flag === "Y") {
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

      // Validate Shift 1
      if (
        day.shift1_open_time &&
        day.shift1_close_time &&
        day.shift1_open_time >= day.shift1_close_time
      ) {
        throw new Error(`${day.day_name}: Shift 1 opening time must be before closing time.`);
      }

      // Validate Shift 2
      if (
        day.shift2_open_time &&
        day.shift2_close_time &&
        day.shift2_open_time >= day.shift2_close_time
      ) {
        throw new Error(`${day.day_name}: Shift 2 opening time must be before closing time.`);
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
        WHERE id=?
        `,
        [
          day.shift1_open_time,
          day.shift1_close_time,
          day.shift2_open_time,
          day.shift2_close_time,
          day.active_flag,
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