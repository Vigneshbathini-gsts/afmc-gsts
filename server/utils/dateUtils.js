/**
 * Centralized Date Utilities for Backend
 */

const toISO = (date) => {
  if (!date) return null;
  const d = new Date(date);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

const getStartOfDay = (dateString) => {
  const d = dateString ? new Date(dateString) : new Date();
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 19).replace('T', ' ');
};

const getEndOfDay = (dateString) => {
  const d = dateString ? new Date(dateString) : new Date();
  if (isNaN(d.getTime())) return null;
  d.setHours(23, 59, 59, 999);
  return d.toISOString().slice(0, 19).replace('T', ' ');
};

/**
 * Safely parses various formats (MM/DD/YYYY or YYYY-MM-DD) into a standard Date object
 */
const parseDate = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  
  // Handle MM/DD/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) {
    const [m, d, y] = raw.split('/');
    return new Date(y, m - 1, d);
  }
  
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
};

const formatToSql = (date) => {
  const d = date instanceof Date ? date : parseDate(date);
  if (!d) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
};

module.exports = {
  toISO,
  getStartOfDay,
  getEndOfDay,
  formatToSql,
  parseDate
};