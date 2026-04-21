export const toInitCap = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/(^|\\s)\\S/g, (match) => match.toUpperCase());

export const stripHtml = (value) =>
  typeof value === "string" ? value.replace(/<[^>]*>/g, "") : value;

