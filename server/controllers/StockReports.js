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
        stock_summary.item_code,
        stock_summary.item_name,
        latest_price.unit_price,
        stock_summary.total_price,
        GREATEST(
          stock_summary.total_stock_quantity - IFNULL(reserved_summary.reserved_stock, 0),
          0
        ) AS AVAILABLE_STOCK,
        IFNULL(reserved_summary.reserved_stock, 0) AS RESERVED_STOCK,
        inventory_summary.A_C_UNIT
      FROM (
        SELECT
          xso.item_code,
          xso.item_name,
          IFNULL(SUM(xso.stock_quantity), 0) AS total_stock_quantity,
          SUM(
            CASE
              WHEN UPPER(xso.\`A/C_UNIT\`) = 'NOS' AND xso.stock_quantity > 0
                THEN IFNULL(xso.unit_price, 0)
              ELSE ROUND(
                (xso.unit_price / IFNULL(NULLIF(xso.pegs, 0), 1))
                * IFNULL(xso.stock_quantity, xso.pegs),
                2
              )
            END
          ) AS total_price
        FROM xxafmc_stock_out xso
        WHERE (? IS NULL OR UPPER(xso.item_name) LIKE CONCAT('%', UPPER(?), '%'))
        GROUP BY xso.item_code, xso.item_name
      ) AS stock_summary
      LEFT JOIN (
        SELECT
          latest_rows.item_code,
          ROUND(MAX(latest_rows.calculated_unit_price), 2) AS unit_price
        FROM (
          SELECT
            rp.item_code,
            rp.creation_date,
            rp.unit_price / IFNULL(NULLIF(rp.pegs, 0), 1) AS calculated_unit_price
          FROM xxafmc_stock_out rp
        ) AS latest_rows
        INNER JOIN (
          SELECT
            item_code,
            MAX(creation_date) AS latest_creation_date
          FROM xxafmc_stock_out
          GROUP BY item_code
        ) AS latest_dates
          ON latest_dates.item_code = latest_rows.item_code
         AND latest_dates.latest_creation_date = latest_rows.creation_date
        GROUP BY latest_rows.item_code
      ) AS latest_price
        ON latest_price.item_code = stock_summary.item_code
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
        ON reserved_summary.item_id = stock_summary.item_code
      LEFT JOIN (
        SELECT
          inventory.item_code,
          MAX(inventory.\`A/C_UNIT\`) AS A_C_UNIT
        FROM xxafmc_inventory inventory
        GROUP BY inventory.item_code
      ) AS inventory_summary
        ON inventory_summary.item_code = stock_summary.item_code
      ORDER BY stock_summary.item_name ASC
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
