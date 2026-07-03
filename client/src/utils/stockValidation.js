export function isCocktailOrMocktail(item) {
  return (
    [14, 15].includes(Number(item?.subcategory)) ||
    Boolean(item?.canEdit) ||
    Boolean(item?.hasRecipe)
  );
}

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function getMaxAllowedQuantity(item) {
  const candidates = [
    item?.availableQuantity,
    item?.available_quantity,
    item?.stockQuantityAvailable,
    item?.stockQuantity,
    item?.stock_quantity,
  ];

  for (const candidate of candidates) {
    const numeric = toFiniteNumber(candidate);
    if (numeric === null) continue;
    if (numeric < 0) continue;
    return numeric;
  }
  return null;
}

export function isOutOfStock(item) {
  const status = String(item?.stockStatus ?? item?.stock_status ?? "").trim().toLowerCase();
  return status === "out of stock";
}

export function buildStockConsumptionMap(items = [], { getCocktailDetails = null } = {}) {
  const consumption = new Map();

  for (const item of Array.isArray(items) ? items : []) {
    if (!item) continue;

    const qty = Number(item?.quantity ?? item?.QUANTITY ?? 0);
    if (!Number.isFinite(qty) || qty <= 0) continue;

    if (item?.isFreeItem) continue;

    if (isCocktailOrMocktail(item)) {
      const details = typeof getCocktailDetails === "function" ? getCocktailDetails(item) : [];
      for (const detail of Array.isArray(details) ? details : []) {
        const code = Number(detail?.itemCode ?? detail?.ITEM_CODE ?? detail?.item_id ?? detail?.itemId ?? detail?.code ?? detail?.CODE ?? 0);
        const pegs = Number(detail?.pegs ?? detail?.PEGS ?? detail?.quantity ?? detail?.QUANTITY ?? 0);
        if (!Number.isFinite(code) || code <= 0 || !Number.isFinite(pegs) || pegs <= 0) continue;
        const required = pegs * qty;
        consumption.set(code, (consumption.get(code) || 0) + required);
      }
      continue;
    }

    const code = Number(item?.itemId ?? item?.item_id ?? item?.ITEM_ID ?? item?.item_code ?? item?.ITEM_CODE ?? item?.code ?? item?.CODE ?? 0);
    if (!Number.isFinite(code) || code <= 0) continue;
    consumption.set(code, (consumption.get(code) || 0) + qty);
  }

  return consumption;
}

export function validateNextQuantity(item, nextQuantity) {
  const qty = Number(nextQuantity);
  if (!Number.isFinite(qty) || qty < 1) {
    return { ok: false, message: "Quantity cannot be less than 1." };
  }

  if (isOutOfStock(item)) {
    return { ok: false, message: "Out of stock." };
  }

  const maxAllowed = getMaxAllowedQuantity(item);
  if (maxAllowed === 0) {
    return { ok: false, message: "Out of stock." };
  }

  if (maxAllowed !== null && maxAllowed !== undefined && maxAllowed > 0 && qty > maxAllowed) {
    return { ok: false, message: `Out of stock. Available quantity: ${maxAllowed}` };
  }

  return { ok: true, message: "" };
}

