const db = require("../config/db");

const getMenuPopupDetails = async ({ itemCode, itemId }) => {
  const sql = `
    SELECT
      temp.ITEM_ID AS item_id,
      temp.ITEM_CODE AS item_code,
      temp.ITEM_NAME AS item_name,
      temp.DESCRIPTION AS description,
      ROUND(
        COALESCE(
          NULLIF(temp.UNIT_PRICE, 0),
          latest_txn.unit_price,
          0
        ),
        2
      ) AS unit_price,
      COALESCE(NULLIF(temp.\`A/C_UNIT\`, ''), 'Nos') AS ac_unit,
      temp.CATEGORY_ID AS category_id,
      temp.CREATION_DATE AS creation_date,
      temp.IMAGE AS image,
      temp.MIME_TYPE AS mime_type,
      temp.FILE_NAME AS file_name,
      IFNULL(stock_summary.available_quantity, 0) AS quantity
    FROM (
      SELECT
        XXIVN.ITEM_ID,
        XXIVN.ITEM_CODE,
        XXIVN.ITEM_NAME,
        XXIVN.DESCRIPTION,
        XXIVN.UNIT_PRICE,
        XXIVN.\`A/C_UNIT\`,
        XXIVN.CATEGORY_ID,
        XXIVN.CREATION_DATE,
        XXIVN.IMAGE,
        XXIVN.MIME_TYPE,
        XXIVN.FILE_NAME
      FROM xxafmc_inventory XXIVN
      WHERE 1=1
        AND XXIVN.ITEM_CODE = ?
        AND XXIVN.ITEM_ID = ?
    ) AS temp
    LEFT JOIN (
      SELECT
        xit.ITEM_CODE,
        MAX(xit.RATE) AS unit_price
      FROM xxafmc_items_transactions xit
      WHERE xit.FLAG = 'IN'
      GROUP BY xit.ITEM_CODE
    ) AS latest_txn
      ON latest_txn.ITEM_CODE = temp.ITEM_CODE
    LEFT JOIN (
      SELECT
        xso.ITEM_CODE,
        SUM(IFNULL(xso.STOCK_QUANTITY, 0)) AS available_quantity
      FROM xxafmc_stock_out xso
      GROUP BY xso.ITEM_CODE
    ) AS stock_summary
      ON stock_summary.ITEM_CODE = temp.ITEM_CODE
    LIMIT 0, 1000
  `;

  const [rows] = await db.execute(sql, [Number(itemCode), Number(itemId)]);
  return rows[0] || null;
};

module.exports = {
  getMenuPopupDetails,
};
