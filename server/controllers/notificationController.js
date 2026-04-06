const pool = require("../config/db");

/**
 * GET STOCK OUT NOTIFICATIONS
 */
exports.getStockOutNotifications = async (req, res) => {
  try {
    const query = `
      SELECT 
        b.item_code,
        b.item_name,
        SUM(b.stock_quantity) AS total_stock,
        CONCAT(b.item_name, ' - ', SUM(b.stock_quantity)) AS note_header,
        'Out Of Stock' AS note_text,
        'fa-cart-arrow-down' AS note_icon,
        'rgb(192,0,15)' AS note_icon_color,
        0 AS no_browser_notification
      FROM xxafmc_stock_out b
      WHERE IFNULL(b.msg_read, 'N') = 'N'
      GROUP BY b.item_code, b.item_name
      HAVING SUM(b.stock_quantity) = 0
      ORDER BY b.item_name ASC
    `;

    const [rows] = await pool.query(query);

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error("Error fetching stock out notifications:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching stock out notifications",
      error: error.message,
    });
  }
};

/**
 * MARK STOCK OUT NOTIFICATION AS READ
 */
exports.markStockOutRead = async (req, res) => {
  try {
    const { itemCode } = req.params;

    const query = `
      UPDATE xxafmc_stock_out
      SET msg_read = 'Y'
      WHERE item_code = ?
    `;

    const [result] = await pool.query(query, [itemCode]);

    return res.status(200).json({
      success: true,
      message: "Stock notification marked as read",
      affectedRows: result.affectedRows,
    });
  } catch (error) {
    console.error("Error marking stock notification as read:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating stock notification",
      error: error.message,
    });
  }
};