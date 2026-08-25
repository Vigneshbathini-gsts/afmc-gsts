import React from "react";

/**
 * Consistent 12-hour AM/PM time picker built from plain <select> elements.
 *
 * Native <input type="time"> renders using the DEVICE's locale/OS setting
 * (12-hour vs 24-hour) — so the same app can show "02:30 PM" on one phone
 * and "14:30" on another. Since we render the option labels ourselves here,
 * the display is always 12-hour AM/PM regardless of device settings.
 *
 * Value in/out is always a 24-hour "HH:mm" string (or "" for empty), so it
 * remains a drop-in replacement for <input type="time"> against existing
 * backend/state code.
 */

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
const MINUTES = Array.from({ length: 60 }, (_, i) => i); // 0..59
const pad2 = (n) => String(n).padStart(2, "0");

const parseValue = (value) => {
  if (!value) return { hour12: "", minute: "", period: "AM" };

  const [hStr, mStr] = value.split(":");
  const hour24 = Number(hStr);
  const minute = Number(mStr);

  if (Number.isNaN(hour24) || Number.isNaN(minute)) {
    return { hour12: "", minute: "", period: "AM" };
  }

  const period = hour24 >= 12 ? "PM" : "AM";
  let hour12 = hour24 % 12;
  if (hour12 === 0) hour12 = 12;

  return { hour12, minute, period };
};

const toValue = (hour12, minute, period) => {
  if (hour12 === "" || minute === "") return "";

  let hour24 = Number(hour12) % 12;
  if (period === "PM") hour24 += 12;

  return `${pad2(hour24)}:${pad2(Number(minute))}`;
};

const selectClass =
  "rounded-xl border border-gray-200 bg-white text-gray-800 px-1 sm:px-2 py-2 text-sm outline-none focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20 disabled:opacity-50 disabled:cursor-not-allowed";

export default function TimePicker({
  value,
  onChange,
  disabled = false,
  className = "",
  clearable = true,
}) {
  const { hour12, minute, period } = parseValue(value);

  const emit = (nextHour12, nextMinute, nextPeriod) => {
    onChange(toValue(nextHour12, nextMinute, nextPeriod));
  };

  const handleHourChange = (event) => {
    const nextHour = event.target.value;
    emit(nextHour, minute === "" ? 0 : minute, period);
  };

  const handleMinuteChange = (event) => {
    const nextMinute = event.target.value;
    emit(hour12 === "" ? 12 : hour12, nextMinute, period);
  };

  const handlePeriodChange = (event) => {
    const nextPeriod = event.target.value;
    emit(hour12 === "" ? 12 : hour12, minute === "" ? 0 : minute, nextPeriod);
  };

  return (
    <div className={`flex items-center justify-center gap-0.5 sm:gap-1.5 ${className}`}>
      <select
        aria-label="Hour"
        value={hour12}
        disabled={disabled}
        onChange={handleHourChange}
        className={selectClass}
      >
        {clearable && <option value="">--</option>}
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {pad2(h)}
          </option>
        ))}
      </select>

      <span className="text-gray-400 dark:text-gray-500">:</span>

      <select
        aria-label="Minute"
        value={minute}
        disabled={disabled}
        onChange={handleMinuteChange}
        className={selectClass}
      >
        {clearable && <option value="">--</option>}
        {MINUTES.map((m) => (
          <option key={m} value={m}>
            {pad2(m)}
          </option>
        ))}
      </select>

      <select
        aria-label="AM or PM"
        value={period}
        disabled={disabled}
        onChange={handlePeriodChange}
        className={selectClass}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}