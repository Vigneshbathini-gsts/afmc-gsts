function formatDateForDB(dateValue) {
  if (!dateValue) return null;

  const date = new Date(dateValue);

  if (isNaN(date.getTime())) return null;

  return date.toISOString().split("T")[0];
}

function formatDateTimeForDB(dateValue) {
  if (!dateValue) return null;

  const date = new Date(dateValue);

  if (isNaN(date.getTime())) return null;

  return date.toISOString().slice(0, 19).replace("T", " ");
}

module.exports = {
  formatDateForDB,
  formatDateTimeForDB,
};