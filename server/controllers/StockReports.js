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
          xso.item_code,
          xso.item_name,

          (
              SELECT ROUND(rp.UNIT_PRICE / IFNULL(NULLIF(rp.pegs, 0), 1), 2)
              FROM xxafmc_stock_out rp
              WHERE rp.ITEM_CODE = xso.item_code
              ORDER BY rp.CREATION_DATE DESC
              LIMIT 1
          ) AS unit_price,

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
          ) AS total_price,

          (
              IFNULL(SUM(xso.STOCK_QUANTITY), 0) -
              IFNULL((
                  SELECT SUM(xod.QUANTITY)
                  FROM xxafmc_order_details xod
                  WHERE xod.ITEM_ID = xso.ITEM_CODE
                    AND xod.order_status IS NULL
                    AND xod.price IS NULL
                    AND NOT EXISTS (
                          SELECT 1 FROM xxafmc_invoices xi
                          WHERE xi.ORDER_NUM = xod.ORDER_ID
                    )
              ), 0)
          ) AS AVAILABLE_STOCK,

          (
              SELECT IFNULL(SUM(xod.QUANTITY), 0)
              FROM xxafmc_order_details xod
              WHERE xod.ITEM_ID = xso.ITEM_CODE
                AND xod.order_status IS NULL
                AND xod.price IS NULL
                AND NOT EXISTS (
                      SELECT 1 FROM xxafmc_invoices xi
                      WHERE xi.ORDER_NUM = xod.ORDER_ID
                )
          ) AS RESERVED_STOCK,

          (
              SELECT inventory.\`A/C_UNIT\`
              FROM xxafmc_inventory inventory
              WHERE inventory.item_code = xso.item_code
              LIMIT 1
          ) AS A_C_UNIT

      FROM xxafmc_stock_out xso

      WHERE 
          (? IS NULL OR UPPER(xso.item_name) LIKE CONCAT('%', UPPER(?), '%'))

      GROUP BY xso.item_code, xso.item_name
      ORDER BY xso.item_name ASC
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
