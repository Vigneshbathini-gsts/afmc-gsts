export const toInitCap = (value) => {
  const input = String(value ?? "").trim();
  if (!input) return "";

  const upperUnits = new Set(["ml", "l", "kg", "g", "gm", "mg", "pcs"]);
  const preserveAcronyms = new Set(["GST", "VAT", "CGST", "SGST", "IGST", "UPI", "POS"]);

  return input
    .split(/\s+/)
    .map((word) => {
      // Preserve common acronyms/units (already uppercase) and code-like tokens.
      // Examples: "ML", "KG", "GST", "NO", "250ML", "ITEM-01"
      const hasDigit = /\d/.test(word);
      const hasHyphenOrUnderscore = /[-_]/.test(word);
      const isAllCaps = /^[^a-z]*[A-Z][^a-z]*$/.test(word); // contains uppercase and no lowercase

      if (upperUnits.has(word.toLowerCase())) return word.toUpperCase();
      if (hasDigit || hasHyphenOrUnderscore) return word;
      if (isAllCaps && preserveAcronyms.has(word)) return word;

      const lower = word.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
};

export const stripHtml = (value) =>
  typeof value === "string" ? value.replace(/<[^>]*>/g, "") : value;

