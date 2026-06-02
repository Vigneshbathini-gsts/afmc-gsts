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

