const db = require("../config/db");


exports.Pubmenubuymodel = async (ORDER_NUMBER ) =>{
    const query = `
    SELECT 
    xxod.ITEM_ID,
    CONCAT(
        'Name: ', XXINV.ITEM_NAME,
        ' Quantity: ', xxod.QUANTITY
    ) AS CARD_TEXT,
    xxod.SUBTOTAL,
    XXINV.IMAGE,
    LENGTH(XXINV.IMAGE) AS CARD_TITLE,
    XXINV.ITEM_CODE,
    '#' AS CARD_LINK,
    CASE 
        WHEN xxod.PRICE = 0 THEN NULL
        ELSE NULL
    END AS CARD_SUBTEXT
FROM xxafmc_order_details  xxod
JOIN xxafmc_inventory XXINV
    ON xxod.item_id = XXINV.item_code
WHERE xxod.order_id = ?;`

     const [rows] = await db.execute(query,[ORDER_NUMBER]);
     return rows

}
