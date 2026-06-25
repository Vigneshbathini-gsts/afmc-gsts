const db = require("../config/db");

exports.getStockReport = async (req, res) => {
  try {
    const { itemName, itemCode, limit, offset } = req.query;

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
      SELECT
        bar_stock.item_code,
        bar_stock.item_name,
        ROUND(IFNULL(bar_stock.unit_price, 0), 2) AS unit_price,
        ROUND(IFNULL(bar_stock.unit_price, 0) * IFNULL(bar_stock.stock_quantity, 0), 2) AS total_price,
        GREATEST(IFNULL(bar_stock.stock_quantity, 0) - IFNULL(reserved_summary.reserved_stock, 0), 0) AS AVAILABLE_STOCK,
        IFNULL(reserved_summary.reserved_stock, 0) AS RESERVED_STOCK,
        COALESCE(NULLIF(bar_stock.\`A/C_UNIT\`, ''), 'Nos') AS A_C_UNIT
      FROM (
        SELECT
          xso.ITEM_CODE AS item_code,
          MAX(COALESCE(NULLIF(xso.ITEM_NAME, ''), xi.ITEM_NAME)) AS item_name,
          ROUND(MAX(xso.UNIT_PRICE / IFNULL(NULLIF(xso.PEGS, 0), 1)), 2) AS unit_price,
          SUM(IFNULL(xso.STOCK_QUANTITY, 0)) AS stock_quantity,
          COALESCE(NULLIF(MAX(xso.\`A/C_UNIT\`), ''), NULLIF(MAX(xi.\`A/C_UNIT\`), ''), 'Nos') AS \`A/C_UNIT\`,
          MAX(xi.SUB_CATEGORY) AS sub_category,
          MAX(xso.CREATION_DATE) AS latest_created_date
        FROM xxafmc_stock_out xso
        JOIN xxafmc_inventory xi
          ON xi.ITEM_CODE = xso.ITEM_CODE
        WHERE xso.ITEM_CODE IS NOT NULL
        GROUP BY xso.ITEM_CODE
      ) bar_stock
      LEFT JOIN (
        SELECT
          xod.item_id,
          IFNULL(SUM(
            CASE
              WHEN UPPER(TRIM(COALESCE(xod.type, ''))) = 'LARGE' THEN 2
              ELSE 1
            END * xod.quantity
          ), 0) AS reserved_stock
        FROM xxafmc_order_details xod
        LEFT JOIN xxafmc_invoices xi
          ON xi.order_num = xod.order_id
        WHERE xod.order_status IS NULL
          AND xod.price IS NULL
          AND xi.order_num IS NULL
        GROUP BY xod.item_id
      ) AS reserved_summary
        ON reserved_summary.item_id = bar_stock.item_code
      WHERE bar_stock.sub_category NOT IN (14, 15)
        AND (? IS NULL OR UPPER(bar_stock.item_name) LIKE CONCAT('%', UPPER(?), '%'))
        AND (? IS NULL OR bar_stock.item_code = ?)
     ORDER BY bar_stock.item_code DESC
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


