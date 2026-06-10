export function toInitCap(value) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  if (!text) return "";

  const upperTokens = new Set(["l", "kg", "g", "gm", "pcs"]);

  const normalizeToken = (token) => {
    const raw = String(token || "");
    if (!raw) return "";

    const lower = raw.toLowerCase();
    if (upperTokens.has(lower)) return lower.toUpperCase();

    // Keep ID uppercase
    if (lower === "id") return "ID";
    if (lower === "ml") return "ml";

    const isAllCaps = raw === raw.toUpperCase() && /[A-Z]/.test(raw);
    const hasSeparator = /[\/&]/.test(raw);
    const isNumberLike = /^[0-9]+([.,][0-9]+)?$/.test(raw);
    const isShortAcronym = raw.length <= 3;

    if (isNumberLike) return raw;
    if (hasSeparator) return raw;
    if (isAllCaps && isShortAcronym) return raw;

    return raw
      .toLowerCase()
      .split("-")
      .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : ""))
      .join("-");
  };

  return text
    .replace(/\s+/g, " ")
    .split(" ")
    .map((token) => normalizeToken(token))
    .join(" ");
}

export function stripHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/<[^>]*>/g, "").trim();
}
