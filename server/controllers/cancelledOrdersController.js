const pool = require("../config/db");

/**
 * GET CANCELLED ORDERS REPORT
 */
exports.getCancelledOrders = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    const query = `
      SELECT 
          oh.ORDER_NUM,
          'Cancelled' AS status,
          oh.ORDER_DATE,
          COALESCE(nm.FIRST_NAME, u.FIRST_NAME) AS FIRST_NAME,
          p.PUBMED_NAME AS pubmed_name
      FROM xxafmc_order_header oh
      LEFT JOIN xxafmc_non_members nm ON nm.ID = oh.MEMBER_ID
      LEFT JOIN xxafmc_users u ON u.USER_ID = oh.USER_ID
      LEFT JOIN xxafmc_pubmed p ON p.PUBMED_ID = oh.PUBMED
      WHERE oh.ORDER_NUM IN (
          SELECT ORDER_ID
          FROM xxafmc_order_details
          GROUP BY ORDER_ID
          HAVING COUNT(*) = SUM(
              CASE 
                  WHEN UPPER(TRIM(ORDER_STATUS)) = 'CANCELLED' THEN 1
                  ELSE 0
              END
          )
      )
      AND STR_TO_DATE(oh.ORDER_DATE, '%m/%d/%Y') BETWEEN ? AND ?
      ORDER BY oh.ORDER_NUM DESC
    `;

    const [rows] = await pool.query(query, [fromDate, toDate]);
// console.log("Cancelled Orders Query Result:", rows);
    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error("Error fetching cancelled orders:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching cancelled orders",
      error: error.message,
    });
  }
};