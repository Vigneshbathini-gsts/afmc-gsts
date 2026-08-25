const pool = require("../config/db");


/**
 * GET CANCELLED ORDERS REPORT
 */
exports.getCancelledOrders = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    const normalizeDate = (date) => {
      if (!date) return null;
      const parsed = new Date(date);
      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
    };

    const from = normalizeDate(fromDate);
    const to = normalizeDate(toDate);

    const query = `
      SELECT 
          oh.ORDER_NUM,
          'Cancelled' AS status,
          oh.ORDER_DATE,
          COALESCE(nm.FIRST_NAME, u.FIRST_NAME) AS FIRST_NAME,
          COALESCE(
            NULLIF(
              CONCAT(
                UPPER(LEFT(TRIM(p.PUBMED_NAME), 1)),
                LOWER(SUBSTRING(TRIM(p.PUBMED_NAME), 2))
              ),
              ''
            ),
            NULLIF(TRIM(CAST(oh.PUBMED AS CHAR)), ''),
            'N/A'
          ) AS pubmed_name
      FROM xxafmc_order_header oh
      LEFT JOIN xxafmc_non_members nm ON nm.ID = oh.MEMBER_ID
      LEFT JOIN xxafmc_users u ON u.USER_ID = oh.USER_ID
      LEFT JOIN xxafmc_pubmed p
        ON TRIM(CAST(p.PUBMED_ID AS CHAR)) = TRIM(CAST(oh.PUBMED AS CHAR))
        OR UPPER(TRIM(p.PUBMED_NAME) COLLATE utf8mb4_unicode_ci) =
          UPPER(TRIM(CAST(oh.PUBMED AS CHAR)) COLLATE utf8mb4_unicode_ci)
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
      AND (
        CASE
          WHEN oh.ORDER_DATE LIKE '%/%' THEN STR_TO_DATE(oh.ORDER_DATE, '%m/%d/%Y')
          ELSE DATE(oh.ORDER_DATE)
        END
      ) BETWEEN COALESCE(?, CURDATE()) AND COALESCE(?, CURDATE())
      ORDER BY oh.ORDER_NUM DESC
    `;

    const [rows] = await pool.query(query, [from, to]);
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


