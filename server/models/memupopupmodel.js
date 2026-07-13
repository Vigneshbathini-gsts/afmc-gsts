const db = require("../config/db");
const { usesMemberPricing } = require("../helpers/customerPricing");

const toNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const roundCurrency = (value) => Number(toNumber(value).toFixed(2));

const getMenuPopupDetails = async ({ itemCode, itemId, authUser }) => {
  const normalizedItemCode = Number(itemCode);
  const normalizedItemId = Number(itemId);
  const appUser = String(authUser?.username || authUser?.user_name || "").trim();

  const [inventoryRows] = await db.execute(
    `
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
        IFNULL(inv.FOOD_PR_CHARGES, 0) AS food_pr_charges
      FROM xxafmc_inventory inv
      WHERE inv.ITEM_CODE = ?
        AND inv.ITEM_ID = ?
      LIMIT 1
    `,
    [normalizedItemCode, normalizedItemId]
  );

  const inventory = inventoryRows[0];
  if (!inventory) {
    return null;
  }

  const [userRows, stockRows, barcodeRows] = await Promise.all([
    appUser
      ? db.execute(
          `
          SELECT user_id, role_id, login_type
          FROM xxafmc_users
          WHERE UPPER(user_name) = UPPER(?)
          LIMIT 1
        `,
          [appUser],
        )
      : Promise.resolve([[]]),
    db.execute(
      `
        SELECT
    IFNULL(SUM(IFNULL(xso.STOCK_QUANTITY,0)),0) AS quantity,

    IFNULL(
        MAX(
            CASE
                WHEN IFNULL(xso.STOCK_QUANTITY,0) > 0
                THEN xso.UNIT_PRICE
            END
        ),
        0
    ) AS stock_out_unit_price,

    IFNULL(
        NULLIF(
            MAX(
                CASE
                    WHEN IFNULL(xso.STOCK_QUANTITY,0) > 0 THEN
                        CASE
                            WHEN xso.PEGS IS NULL OR xso.PEGS = 0 THEN 1
                            ELSE xso.PEGS
                        END
                END
            ),
            0
        ),
        1
    ) AS pegs,

    IFNULL(
        MIN(
            CASE
                WHEN IFNULL(xso.STOCK_QUANTITY,0) > 0 THEN
                    CASE
                        WHEN xso.PEGS IS NULL OR xso.PEGS = 0 THEN 1
                        ELSE xso.PEGS
                    END
            END
        ),
        1
    ) AS snacks_pegs

FROM xxafmc_stock_out xso
WHERE xso.ITEM_CODE = ?
      `,
      [normalizedItemCode],
    ),
    db.execute(
      `
        SELECT xso.BARCODE AS barcode
        FROM xxafmc_stock_out xso
        WHERE xso.ITEM_CODE = ?
          AND IFNULL(xso.STOCK_QUANTITY, 0) > 0
        ORDER BY xso.CREATION_DATE ASC
        LIMIT 1
      `,
      [normalizedItemCode],
    ),
  ]);

  const user = userRows[0]?.[0] || null;
  const stock = stockRows[0]?.[0] || {};
  const barcode = barcodeRows[0]?.[0]?.barcode || null;

  const roleId = toNumber(user?.role_id, null);
  const isMember = usesMemberPricing({
    roleId,
    loginType: user?.login_type,
  });
  const categoryId = toNumber(inventory.category_id);
  const subCategory = toNumber(inventory.sub_category, 0);
  const inventoryBasePrice = toNumber(inventory.inventory_unit_price);
  const inventoryUnitPrice = toNumber(stock.stock_out_unit_price || inventory.inventory_unit_price);
  const pegs = Math.max(toNumber(stock.pegs, 1), 1);
  const snacksPegs = Math.max(toNumber(stock.snacks_pegs, 1), 1);
  const memberProfit = toNumber(inventory.profit);
  const nonMemberProfit = toNumber(inventory.non_member_profit);
  const memberCharges = toNumber(inventory.food_pr_charges);
  const nonMemberCharges = toNumber(inventory.pr_charges);
  const selectedProfit = isMember ? memberProfit : nonMemberProfit;
  const selectedCharges = isMember ? memberCharges : nonMemberCharges;

  let finalPrice = inventoryUnitPrice;

  if (categoryId === 10 && [14, 15].includes(subCategory)) {
    finalPrice = inventoryBasePrice + selectedCharges;
  } else if (categoryId === 10) {
    const pricePerPeg = inventoryUnitPrice / pegs;
    finalPrice =
      pricePerPeg + (pricePerPeg * selectedProfit) / 100 + selectedCharges;
  } else if (categoryId === 14) {
    finalPrice =
      (inventoryUnitPrice + (inventoryUnitPrice * selectedProfit) / 100) /
        snacksPegs +
      selectedCharges;
  } else {
    finalPrice = inventoryBasePrice || inventoryUnitPrice;
  }

  return {
    ...inventory,
    role_id: roleId,
    user_id: user?.user_id ? toNumber(user.user_id, user.user_id) : null,
    sub_category: subCategory,
    quantity: toNumber(stock.quantity),
    profit: selectedProfit,
    pr_charges: selectedCharges,
    member_profit: memberProfit,
    non_member_profit: nonMemberProfit,
    member_pr_charges: memberCharges,
    non_member_pr_charges: nonMemberCharges,
    base_unit_price: roundCurrency(
      categoryId === 10 && [14, 15].includes(subCategory)
        ? inventoryBasePrice
        : inventoryUnitPrice,
    ),
    unit_price: roundCurrency(finalPrice),
    pegs,
    snacks_pegs: snacksPegs,
    barcode,
  };
};

module.exports = {
  getMenuPopupDetails,
};
