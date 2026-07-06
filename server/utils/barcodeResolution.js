function resolveBarcodeScanItem({ stockOutRows = [], transactionRows = [], inventoryRows = [] }) {
  const stockOutRow = Array.isArray(stockOutRows) ? stockOutRows[0] : null;
  const transactionRow = Array.isArray(transactionRows) ? transactionRows[0] : null;
  const inventoryRow = Array.isArray(inventoryRows) ? inventoryRows[0] : null;

  const itemCode = String(
    stockOutRow?.ITEM_CODE || transactionRow?.ITEM_CODE || inventoryRow?.ITEM_CODE || ""
  ).trim();

  if (!itemCode) {
    return null;
  }

  const inventoryName = String(
    inventoryRow?.ITEM_NAME || inventoryRow?.item_name || ""
  ).trim();

  return {
    ITEM_CODE: itemCode,
    ITEM_NAME: inventoryName || String(stockOutRow?.ITEM_NAME || "").trim(),
    STOCK_QUANTITY: Number(
      stockOutRow?.STOCK_QUANTITY ?? inventoryRow?.STOCK_QUANTITY ?? inventoryRow?.stock_quantity ?? 0
    ) || 0,
    ac_unit: String(
      stockOutRow?.ac_unit || stockOutRow?.["A/C_UNIT"] || inventoryRow?.ac_unit || inventoryRow?.["A/C_UNIT"] || ""
    ).trim(),
    UNIT_PRICE: Number(
      stockOutRow?.UNIT_PRICE ?? transactionRow?.RATE ?? inventoryRow?.UNIT_PRICE ?? 0
    ) || 0,
    PEGS: Number(stockOutRow?.PEGS ?? inventoryRow?.PEGS ?? 0) || 0,
    CATEGORY_ID: inventoryRow?.CATEGORY_ID ?? inventoryRow?.category_id ?? null,
    SUB_CATEGORY: inventoryRow?.SUB_CATEGORY ?? inventoryRow?.sub_category ?? null,
    PROFIT: inventoryRow?.PROFIT ?? inventoryRow?.profit ?? null,
    NON_MEMBER_PROFIT: inventoryRow?.NON_MEMBER_PROFIT ?? inventoryRow?.non_member_profit ?? null,
    PR_CHARGES: inventoryRow?.PR_CHARGES ?? inventoryRow?.pr_charges ?? null,
    FOOD_PR_CHARGES: inventoryRow?.FOOD_PR_CHARGES ?? inventoryRow?.food_pr_charges ?? null,
  };
}

module.exports = {
  resolveBarcodeScanItem,
};
