// order controller
const pool = require("../config/db");

/**
 * GET ORDER DETAILS BY ORDER NUMBER
 */
exports.getOrderDetailsByOrderNumber = async (req, res) => {
  try {
    const { orderNumber } = req.params;

    if (!orderNumber) {
      return res.status(400).json({
        success: false,
        message: "Order number is required",
      });
    }

    const query = `
      SELECT 
          xkn.item_name,
          xkn.status,
          xod.quantity,
          IFNULL(xod.type, 'NA') AS type
      FROM xxafmc_order_details xod
      JOIN xxafmc_kitchen_notification xkn
          ON xod.order_id = xkn.ordernumber
         AND xod.item_id = xkn.item_id
      WHERE xkn.ordernumber = ?
    `;

    const [rows] = await pool.query(query, [orderNumber]);
console.log("Order Details Query Result:", rows);
    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error("Error fetching order details:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching order details",
      error: error.message,
    });
  }
};