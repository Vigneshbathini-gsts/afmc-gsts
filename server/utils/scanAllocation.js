function buildScanEntriesForComponents({ requestedQty, components, baseEntry }) {
  if (!Number.isFinite(requestedQty) || requestedQty <= 0) {
    return [];
  }

  const entries = [];
  const safeRequestedQty = Math.max(1, Math.floor(Number(requestedQty) || 1));

  for (const comp of components || []) {
    const collQty = Number(comp?.coll_qty || 0);
    if (!Number.isFinite(collQty) || collQty <= 0) continue;

    const qtyToAdd = Math.min(safeRequestedQty, collQty);
    if (qtyToAdd <= 0) continue;

    entries.push({
      ...baseEntry,
      itemCode: comp.item_code,
      itemName: comp.item_name,
      scanQuantity: qtyToAdd,
      lineTotalPrice: Number((Number(baseEntry.itemPrice || 0) * qtyToAdd).toFixed(2)),
      orderLineId: comp.Mix === 'MO' ? baseEntry.orderLineId : comp.order_line_id,
      parentItem: comp.inventory_item_code,
      isCocktailIngredient: comp.Mix === 'MO',
    });
  }

  return entries;
}

module.exports = {
  buildScanEntriesForComponents,
};
