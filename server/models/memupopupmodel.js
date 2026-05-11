const db = require("../config/db");

const toNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const roundCurrency = (value) => Number(toNumber(value).toFixed(2));

const getMenuPopupDetails = async ({ itemCode, itemId, authUser }) => {
  const appUser = String(authUser?.username || authUser?.user_name || "").trim();

  const sql = `
    SELECT
      inv.ITEM_ID AS item_id,
      inv.ITEM_CODE AS item_code,
      inv.ITEM_NAME AS item_name,
      inv.DESCRIPTION AS description,
      IFNULL(inv.UNIT_PRICE, 0) AS inventory_unit_price,
      COALESCE(NULLIF(inv.\`A/C_UNIT\`, ''), 'Nos') AS ac_unit,
      inv.CATEGORY_ID AS category_id,
      inv.SUB_CATEGORY AS sub_category,
      inv.CREATION_DATE AS creation_date,
      inv.IMAGE AS image,
      inv.MIME_TYPE AS mime_type,
      inv.FILE_NAME AS file_name,
      IFNULL(inv.PROFIT, 0) AS profit,
      IFNULL(inv.NON_MEMBER_PROFIT, 0) AS non_member_profit,
      IFNULL(inv.PR_CHARGES, 0) AS pr_charges,
      IFNULL(inv.FOOD_PR_CHARGES, 0) AS food_pr_charges,
      IFNULL(stock_summary.available_quantity, 0) AS quantity,
      IFNULL(stock_out_price.max_unit_price, 0) AS stock_out_unit_price,
      IFNULL(stock_out_pegs.pegs, 1) AS pegs,
      barcode_info.barcode AS barcode,
      xu.user_id AS user_id,
      xu.role_id AS role_id
    FROM xxafmc_inventory inv
    LEFT JOIN (
      SELECT
        xso.ITEM_CODE,
        SUM(IFNULL(xso.STOCK_QUANTITY, 0)) AS available_quantity
      FROM xxafmc_stock_out xso
      GROUP BY xso.ITEM_CODE
    ) AS stock_summary
      ON stock_summary.ITEM_CODE = inv.ITEM_CODE
    LEFT JOIN (
      SELECT
        xso.ITEM_CODE,
        MAX(xso.UNIT_PRICE) AS max_unit_price
      FROM xxafmc_stock_out xso
      WHERE IFNULL(xso.STOCK_QUANTITY, 0) > 0
      GROUP BY xso.ITEM_CODE
    ) AS stock_out_price
      ON stock_out_price.ITEM_CODE = inv.ITEM_CODE
    LEFT JOIN (
      SELECT
        xso.ITEM_CODE,
        IFNULL(NULLIF(MAX(xso.PEGS), 0), 1) AS pegs
      FROM xxafmc_stock_out xso
      GROUP BY xso.ITEM_CODE
    ) AS stock_out_pegs
      ON stock_out_pegs.ITEM_CODE = inv.ITEM_CODE
    LEFT JOIN (
      SELECT
        base.ITEM_CODE,
        (
          SELECT xso1.BARCODE
          FROM xxafmc_stock_out xso1
          WHERE xso1.ITEM_CODE = base.ITEM_CODE
            AND IFNULL(xso1.STOCK_QUANTITY, 0) > 0
          ORDER BY xso1.CREATION_DATE ASC
          LIMIT 1
        ) AS barcode
      FROM xxafmc_stock_out base
      GROUP BY base.ITEM_CODE
    ) AS barcode_info
      ON barcode_info.ITEM_CODE = inv.ITEM_CODE
    LEFT JOIN xxafmc_users xu
      ON UPPER(xu.user_name) = UPPER(?)
    WHERE inv.ITEM_CODE = ?
      AND inv.ITEM_ID = ?
    LIMIT 1
  `;

  const [rows] = await db.execute(sql, [appUser, Number(itemCode), Number(itemId)]);
  const row = rows[0];

  if (!row) {
    return null;
  }

  const roleId = toNumber(row.role_id, null);
  const isMember = roleId === 20;
  const categoryId = toNumber(row.category_id);
  const subCategory = toNumber(row.sub_category, 0);
  const inventoryBasePrice = toNumber(row.inventory_unit_price);
  const inventoryUnitPrice = toNumber(row.stock_out_unit_price || row.inventory_unit_price);
  const pegs = Math.max(toNumber(row.pegs, 1), 1);
  const memberProfit = toNumber(row.profit);
  const nonMemberProfit = toNumber(row.non_member_profit);
  const memberCharges = toNumber(row.food_pr_charges);
  const nonMemberCharges = toNumber(row.pr_charges);

  let finalPrice = inventoryUnitPrice;
  let selectedProfit = isMember ? memberProfit : nonMemberProfit;
  let selectedCharges = isMember ? memberCharges : nonMemberCharges;

  if (categoryId === 10 && [14, 15].includes(subCategory)) {
    finalPrice = inventoryBasePrice + selectedCharges;
  } else if (categoryId === 10) {
    const pricePerPeg = inventoryUnitPrice / pegs;
    finalPrice = pricePerPeg + (pricePerPeg * selectedProfit / 100) + selectedCharges;
  } else if (categoryId === 14) {
    finalPrice = inventoryUnitPrice + (inventoryUnitPrice * selectedProfit / 100) + selectedCharges;
  } else {
    finalPrice = inventoryBasePrice || inventoryUnitPrice;
  }

  return {
    ...row,
    role_id: roleId,
    user_id: row.user_id ? toNumber(row.user_id, row.user_id) : null,
    sub_category: subCategory,
    profit: selectedProfit,
    pr_charges: selectedCharges,
    member_profit: memberProfit,
    non_member_profit: nonMemberProfit,
    member_pr_charges: memberCharges,
    non_member_pr_charges: nonMemberCharges,
    base_unit_price: roundCurrency(categoryId === 10 && [14, 15].includes(subCategory) ? inventoryBasePrice : inventoryUnitPrice),
    unit_price: roundCurrency(finalPrice),
    pegs,
  };
};

module.exports = {
  getMenuPopupDetails,
};


