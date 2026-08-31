const db = require("../config/db");


exports.getStockReport = async (req, res) => {
  try {
    const { itemName, itemCode, limit, offset } = req.query;
// console.log("Received query parameters:", { itemName, itemCode, limit, offset });
    const parsedLimit = parseInt(limit, 10);
    const parsedOffset = parseInt(offset, 10);
    const limitNum = Number.isFinite(parsedLimit) && parsedLimit > 0
      ? parsedLimit
      : 20;
    const offsetNum = Number.isFinite(parsedOffset) && parsedOffset >= 0
      ? parsedOffset
      : 0;

    const itemValue =
      typeof itemName === "string" && itemName.trim() !== ""
        ? itemName.trim()
        : null;
    const itemCodeValue =
      typeof itemCode === "string" && itemCode.trim() !== ""
        ? itemCode.trim()
        : null;

    const query = `
WITH latest_price AS (
    SELECT
        ITEM_CODE,
        ROUND(UNIT_PRICE / IFNULL(NULLIF(PEGS,0),1),2) AS unit_price,
        PEGS,
        ROW_NUMBER() OVER (
            PARTITION BY ITEM_CODE
            ORDER BY CREATION_DATE DESC
        ) rn
    FROM xxafmc_stock_out
),

stock_summary AS (
    SELECT
        xso.ITEM_CODE,
        MAX(xso.ITEM_NAME) AS ITEM_NAME,
        SUM(IFNULL(xso.STOCK_QUANTITY,0)) AS STOCK_QUANTITY,
        MAX(xso.PEGS) AS PEGS,
        MAX(inv.\`A/C_UNIT\`) AS A_C_UNIT,
        MAX(inv.SUB_CATEGORY) AS SUB_CATEGORY,
        MAX(inv.STOCK_QUANTITY) AS INVENTORY_STOCK_QUANTITY
    FROM xxafmc_stock_out xso
    LEFT JOIN xxafmc_inventory inv
        ON inv.ITEM_CODE = xso.ITEM_CODE
    GROUP BY xso.ITEM_CODE
),

reserved_summary AS (
    SELECT
        xod.item_id,
        SUM(IFNULL(xod.quantity,0)) reserved_stock
    FROM xxafmc_order_details xod
    LEFT JOIN xxafmc_invoices xi
        ON xi.order_num=xod.order_id
    WHERE xod.order_status IS NULL
      AND xod.price IS NULL
      AND xi.order_num IS NULL
    GROUP BY xod.item_id
)

SELECT
    ss.ITEM_CODE AS item_code,
    ss.ITEM_NAME AS item_name,

    ss.STOCK_QUANTITY AS stock_quantity,
    COALESCE(ss.INVENTORY_STOCK_QUANTITY, 0) AS inventory_stock,
    COALESCE(ss.STOCK_QUANTITY, 0) + COALESCE(ss.INVENTORY_STOCK_QUANTITY, 0) AS total_stock,

    IFNULL(lp.unit_price,0) AS unit_price,

    ROUND((COALESCE(ss.STOCK_QUANTITY,0) + COALESCE(ss.INVENTORY_STOCK_QUANTITY,0)) * IFNULL(lp.unit_price,0),2) AS value,

    ss.A_C_UNIT,

    GREATEST(
        (COALESCE(ss.STOCK_QUANTITY,0) + COALESCE(ss.INVENTORY_STOCK_QUANTITY,0)) - IFNULL(rs.reserved_stock,0),
        0
    ) AS AVAILABLE_STOCK,

    IFNULL(rs.reserved_stock,0) AS RESERVED_STOCK,

    CASE
        WHEN ss.A_C_UNIT IN ('Nos','Can')
            THEN COALESCE(ss.STOCK_QUANTITY,0) + COALESCE(ss.INVENTORY_STOCK_QUANTITY,0)

        WHEN IFNULL(ss.PEGS,0) > 0
            THEN FLOOR((COALESCE(ss.STOCK_QUANTITY,0) + COALESCE(ss.INVENTORY_STOCK_QUANTITY,0))/ss.PEGS)

        ELSE 0
    END AS bottles,

    CASE
        WHEN ss.A_C_UNIT IN ('Nos','Can')
            THEN 0

        WHEN IFNULL(ss.PEGS,0) > 0
            THEN MOD((COALESCE(ss.STOCK_QUANTITY,0) + COALESCE(ss.INVENTORY_STOCK_QUANTITY,0)),ss.PEGS)

        ELSE COALESCE(ss.STOCK_QUANTITY,0) + COALESCE(ss.INVENTORY_STOCK_QUANTITY,0)
    END AS pegs

FROM stock_summary ss

LEFT JOIN latest_price lp
    ON lp.ITEM_CODE=ss.ITEM_CODE
   AND lp.rn=1

LEFT JOIN reserved_summary rs
    ON rs.item_id=ss.ITEM_CODE

WHERE ss.SUB_CATEGORY NOT IN (14,15)
  AND (? IS NULL OR UPPER(ss.ITEM_NAME) LIKE CONCAT('%',UPPER(?),'%'))
  AND (? IS NULL OR ss.ITEM_CODE=?)

ORDER BY ss.ITEM_CODE DESC

LIMIT ${limitNum} OFFSET ${offsetNum}
`;

    const [results] = await db.execute(query, [
      itemValue,
      itemValue,
      itemCodeValue,
      itemCodeValue,
    ]);

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("Stock Report Error:", error);

    res.status(500).json({
      success: false,
      message: "Error fetching stock report",
      error: error.message,
    });
  }
};



