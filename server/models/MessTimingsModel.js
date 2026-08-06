const db = require("../config/db");

const getWeeklyTimings = async () => {
  const [rows] = await db.execute(`
    SELECT
      id,
      day_name,
      TIME_FORMAT(shift1_open_time, '%H:%i') AS shift1_open_time,
      TIME_FORMAT(shift1_close_time, '%H:%i') AS shift1_close_time,
      TIME_FORMAT(shift2_open_time, '%H:%i') AS shift2_open_time,
      TIME_FORMAT(shift2_close_time, '%H:%i') AS shift2_close_time,
      active_flag,
      created_by,
      DATE_FORMAT(created_on, '%Y-%m-%d %H:%i:%s') AS created_on,
      updated_by,
      DATE_FORMAT(updated_on, '%Y-%m-%d %H:%i:%s') AS updated_on
    FROM xxafmc_mess_timings_week
    ORDER BY FIELD(
      day_name,
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
      'SUNDAY'
    );
  `);

  return rows;
};

const updateDayTiming = async ({
  id,
  shift1_open_time,
  shift1_close_time,
  shift2_open_time,
  shift2_close_time,
  active_flag,
  updatedBy,
}) => {
  const [result] = await db.execute(
    `
    UPDATE xxafmc_mess_timings_week
    SET
      shift1_open_time = ?,
      shift1_close_time = ?,
      shift2_open_time = ?,
      shift2_close_time = ?,
      active_flag = ?,
      updated_by = ?,
      updated_on = NOW()
    WHERE id = ?
    `,
    [
      shift1_open_time,
      shift1_close_time,
      shift2_open_time,
      shift2_close_time,
      active_flag,
      updatedBy,
      id,
    ]
  );

  return result;
};

module.exports = {
  getWeeklyTimings,
  updateDayTiming,
};