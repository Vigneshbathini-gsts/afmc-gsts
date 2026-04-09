const db = require("../config/db");

exports.getStockReport = async (req, res) => {
  try {
    const { itemName, limit, offset } = req.query;

    const parsedLimit = parseInt(limit, 10);
    const parsedOffset = parseInt(offset, 10);
    const limitNum = Number.isFinite(parsedLimit) && parsedLimit > 0
      ? parsedLimit
      : 15;
    const offsetNum = Number.isFinite(parsedOffset) && parsedOffset >= 0
      ? parsedOffset
      : 0;

    const itemValue =
      typeof itemName === "string" && itemName.trim() !== ""
        ? itemName.trim()
        : null;

    const query = `
      SELECT
        inv.item_code,
        inv.item_name,
        ROUND(COALESCE(NULLIF(inv.unit_price, 0), latest_price.unit_price, 0), 2) AS unit_price,
        ROUND(
          COALESCE(NULLIF(inv.unit_price, 0), latest_price.unit_price, 0)
          * IFNULL(inv.stock_quantity, 0),
          2
        ) AS total_price,
        GREATEST(IFNULL(inv.stock_quantity, 0) - IFNULL(reserved_summary.reserved_stock, 0), 0) AS AVAILABLE_STOCK,
        IFNULL(reserved_summary.reserved_stock, 0) AS RESERVED_STOCK,
        COALESCE(NULLIF(inv.\`A/C_UNIT\`, ''), 'Nos') AS A_C_UNIT
      FROM (
        SELECT
          item_code,
          MAX(item_name) AS item_name,
          MAX(unit_price) AS unit_price,
          SUM(IFNULL(stock_quantity, 0)) AS stock_quantity,
          MAX(\`A/C_UNIT\`) AS \`A/C_UNIT\`,
          MAX(sub_category) AS sub_category
        FROM xxafmc_inventory
        GROUP BY item_code
      ) inv
      LEFT JOIN (
        SELECT
          recent_rows.item_code,
          ROUND(MAX(recent_rows.unit_price / IFNULL(NULLIF(recent_rows.pegs, 0), 1)), 2) AS unit_price
        FROM xxafmc_stock_out recent_rows
        INNER JOIN (
          SELECT item_code, MAX(creation_date) AS latest_creation_date
          FROM xxafmc_stock_out
          GROUP BY item_code
        ) latest_dates
          ON latest_dates.item_code = recent_rows.item_code
         AND latest_dates.latest_creation_date = recent_rows.creation_date
        GROUP BY recent_rows.item_code
      ) AS latest_price
        ON latest_price.item_code = inv.item_code
      LEFT JOIN (
        SELECT
          xod.item_id,
          IFNULL(SUM(xod.quantity), 0) AS reserved_stock
        FROM xxafmc_order_details xod
        LEFT JOIN xxafmc_invoices xi
          ON xi.order_num = xod.order_id
        WHERE xod.order_status IS NULL
          AND xod.price IS NULL
          AND xi.order_num IS NULL
        GROUP BY xod.item_id
      ) AS reserved_summary
        ON reserved_summary.item_id = inv.item_code
      WHERE inv.sub_category NOT IN (14, 15)
        AND (? IS NULL OR UPPER(inv.item_name) LIKE CONCAT('%', UPPER(?), '%'))
      ORDER BY inv.item_name ASC
      LIMIT ${limitNum} OFFSET ${offsetNum}
    `;

    const [results] = await db.execute(query, [itemValue, itemValue]);

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
