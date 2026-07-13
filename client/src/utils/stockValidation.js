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
function getItemType(item) {
  const rawType =
    // Prefer the real cart column (stored as `description` in xxafmc_cart_items)
    item?.description ??
    item?.DESCRIPTION ??
    item?.type ??
    item?.TYPE ??
    // Fallbacks for any legacy payloads
    item?.item_type ??
    item?.ITEM_TYPE ??
    item?.pegType ??
    item?.peg_type ??
    item?.TYPE_OF_PEG ??
    null;

  if (rawType === null || rawType === undefined || rawType === "") {
    return null;
  }

  return String(rawType).trim();
}

function isLargePegType(item) {
  const type = String(getItemType(item) || "").trim().toUpperCase();
  // Your cart payload might use different markers; treat "L" and "LARGE" as Large.
  return type === "L" || type === "LARGE";
}


export function getItemPegMultiplier(item) {
  return isLargePegType(item) ? 2 : 1;
}

export function getEffectiveAvailableQuantity(item, availablePegs) {
  const rawAvailable = Number.isFinite(Number(availablePegs)) ? Number(availablePegs) : 0;
  const multiplier = getItemPegMultiplier(item);
  if (multiplier <= 1) return Math.max(0, rawAvailable);
  return Math.max(0, Math.floor(rawAvailable / multiplier));
}

export function getPegTypeOrderLimitMessage(item, availablePegs, fallbackMessage = "Out of stock.", selectedPegType = null) {
  const normalizedType = String(selectedPegType ?? getItemType(item) ?? "").trim().toLowerCase();

  if (normalizedType === "s" || normalizedType === "small") {
    const maxQty = Number.isFinite(Number(availablePegs)) ? Math.max(0, Number(availablePegs)) : 0;
    return `Only ${maxQty} Small drink(s) can be ordered with the current stock. Please reduce the quantity.`;
  }

  if (normalizedType === "l" || normalizedType === "large") {
    const maxQty = Number.isFinite(Number(availablePegs)) ? Math.max(0, Math.floor(Number(availablePegs) / 2)) : 0;
    return `Only ${maxQty} Large drink(s) can be ordered with the current stock. Please reduce the quantity.`;
  }

  return fallbackMessage;
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
      const multiplier = getItemPegMultiplier(item);
      for (const detail of Array.isArray(details) ? details : []) {
        const code = Number(detail?.itemCode ?? detail?.ITEM_CODE ?? detail?.item_id ?? detail?.itemId ?? detail?.code ?? detail?.CODE ?? 0);
        const pegs = Number(detail?.pegs ?? detail?.PEGS ?? detail?.quantity ?? detail?.QUANTITY ?? 0);
        if (!Number.isFinite(code) || code <= 0 || !Number.isFinite(pegs) || pegs <= 0) continue;
        const required = pegs * qty * multiplier;
        consumption.set(code, (consumption.get(code) || 0) + required);
      }
      continue;
    }

    const code = Number(item?.itemId ?? item?.item_id ?? item?.ITEM_ID ?? item?.item_code ?? item?.ITEM_CODE ?? item?.code ?? item?.CODE ?? 0);
    if (!Number.isFinite(code) || code <= 0) continue;
    const multiplier = getItemPegMultiplier(item);
    const effectiveQty = qty * multiplier;
    consumption.set(code, (consumption.get(code) || 0) + effectiveQty);
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

  if (maxAllowed !== null && maxAllowed !== undefined && maxAllowed > 0) {
    const effectiveAllowed = getEffectiveAvailableQuantity(item, maxAllowed);
    if (effectiveAllowed <= 0) {
      return { ok: false, message: "Out of stock." };
    }
    if (qty > effectiveAllowed) {
      return {
        ok: false,
        message: getPegTypeOrderLimitMessage(item, maxAllowed, `Out of stock. Available quantity: ${effectiveAllowed}`),
      };
    }
  }

  return { ok: true, message: "" };
}

