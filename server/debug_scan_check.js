const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  const conn = await pool.getConnection();
  try {
    const ORDERNUMBER = 7182;
    const scanItemCode = 42;
    const forcedParentItem = '';

    const [rows] = await conn.query(
      'SELECT * FROM xxafmc_order_details WHERE order_id = ? AND item_id = ?',
      [ORDERNUMBER, scanItemCode]
    );
    console.log('order_details row', rows);

    const [qty] = await conn.query(
      `SELECT SUM(quantity) AS total_quantity FROM (
        SELECT (COALESCE(x.pegs, 1) * COALESCE(x.quantity, 0)) AS quantity FROM xxafmc_custom_cocktails_mocktails_details x 
        JOIN xxafmc_order_details xo ON x.inventory_item_code = xo.item_id 
        WHERE x.order_number = ? AND x.item_code = ?
          AND (? = '' OR x.inventory_item_code = ?)
        UNION ALL
        SELECT (COALESCE(x.pegs, 1) * COALESCE(x.quantity, 0)) AS quantity FROM xxafmc_custom_cocktails_mocktails_details_dummy x 
        JOIN xxafmc_order_details xo ON x.inventory_item_code = xo.item_id 
        WHERE x.order_number = ? AND x.item_code = ?
          AND (? = '' OR x.inventory_item_code = ?)
        UNION ALL
        SELECT (COALESCE(xcmd.pegs, 1) * COALESCE(xcmd.quantity, 0)) AS quantity
        FROM xxafmc_cocktails_mocktails_details xcmd
        WHERE (
            (? <> '' AND xcmd.inventory_item_code = ?)
            OR
            (? = '' AND xcmd.inventory_item_code IN (
              SELECT item_id FROM xxafmc_order_details WHERE order_id = ?
            ))
          )
          AND xcmd.item_code = ?
          AND NOT EXISTS (
            SELECT 1
            FROM xxafmc_custom_cocktails_mocktails_details x
            WHERE x.inventory_item_code = xcmd.inventory_item_code
              AND x.order_number = ?
          )
        UNION ALL
        SELECT (CASE WHEN xo.type = 'Large' THEN 2 ELSE 1 END * COALESCE(xo.quantity, 0)) AS quantity 
        FROM xxafmc_order_details xo 
        WHERE xo.order_id = ? AND xo.item_id = ?
      ) a`,
      [
        ORDERNUMBER,
        scanItemCode,
        forcedParentItem,
        forcedParentItem,
        ORDERNUMBER,
        scanItemCode,
        forcedParentItem,
        forcedParentItem,
        forcedParentItem,
        scanItemCode,
        forcedParentItem,
        ORDERNUMBER,
        scanItemCode,
        ORDERNUMBER,
        forcedParentItem,
        ORDERNUMBER,
        scanItemCode,
      ]
    );
    console.log('orderedQty result', qty);
  } catch (err) {
    console.error(err);
  } finally {
    conn.release();
  }
})();
