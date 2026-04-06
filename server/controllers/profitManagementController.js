const pool = require("../config/db");
const { getPricingCondition } = require("../helpers/pricingHelper");

/**
 * MEMBER PRICING UPDATE
 */
exports.updateMemberPricing = async (req, res) => {
  try {
    const { category, profit, foodPrCharges } = req.body;

    if (!category || profit === undefined || profit === null) {
      return res.status(400).json({
        success: false,
        message: "Category and profit are required",
      });
    }

    const condition = getPricingCondition(category);

    if (!condition) {
      return res.status(400).json({
        success: false,
        message: "Invalid category selected",
      });
    }

    let query = "";
    let values = [];

    if (category === "Liquor") {
      query = `
        UPDATE xxafmc_inventory
        SET PROFIT = ?
        WHERE ${condition}
      `;
      values = [profit];
    } else if (category === "Snacks") {
      query = `
        UPDATE xxafmc_inventory
        SET PROFIT = ?, FOOD_PR_CHARGES = ?
        WHERE ${condition}
      `;
      values = [profit, foodPrCharges || 0];
    }

    const [result] = await pool.query(query, values);

    return res.status(200).json({
      success: true,
      message: "Member pricing updated successfully",
      affectedRows: result.affectedRows,
    });
  } catch (error) {
    console.error("Error in updateMemberPricing:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating member pricing",
    });
  }
};

/**
 * NON-MEMBER PRICING UPDATE
 */
exports.updateNonMemberPricing = async (req, res) => {
  try {
    const { category, profit, prCharges } = req.body;

    if (!category || profit === undefined || profit === null) {
      return res.status(400).json({
        success: false,
        message: "Category and non-member profit are required",
      });
    }

    const condition = getPricingCondition(category);

    if (!condition) {
      return res.status(400).json({
        success: false,
        message: "Invalid category selected",
      });
    }

    let query = "";
    let values = [];

    if (category === "Liquor") {
      query = `
        UPDATE xxafmc_inventory
        SET NON_MEMBER_PROFIT = ?
        WHERE ${condition}
      `;
      values = [profit];
    } else if (category === "Snacks") {
      query = `
        UPDATE xxafmc_inventory
        SET NON_MEMBER_PROFIT = ?, PR_CHARGES = ?
        WHERE ${condition}
      `;
      values = [profit, prCharges || 0];
    }

    const [result] = await pool.query(query, values);

    return res.status(200).json({
      success: true,
      message: "Non-member pricing updated successfully",
      affectedRows: result.affectedRows,
    });
  } catch (error) {
    console.error("Error in updateNonMemberPricing:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating non-member pricing",
    });
  }
};

/**
 * PRICING REPORT
 */
exports.getPricingReport = async (req, res) => {
  try {
    const query = `
      SELECT 
        category_name,
        MAX(PROFIT) AS PROFIT,
        MAX(CAST(COALESCE(FOOD_PR_CHARGES, 0) AS DECIMAL(10,2))) AS FOOD_PR_CHARGES,
        MAX(NON_MEMBER_PROFIT) AS NON_MEMBER_PROFIT,
        MAX(CAST(COALESCE(PR_CHARGES, 0) AS DECIMAL(10,2))) AS PR_CHARGES
      FROM (
        SELECT 
          CASE
            WHEN xi.CATEGORY_ID = 10 AND xi.SUB_CATEGORY NOT IN (14, 15) THEN 'Liquor'
            WHEN xi.CATEGORY_ID = 14 AND xi.SUB_CATEGORY IN (7, 10) THEN 'Snacks'
          END AS category_name,
          xi.PROFIT,
          xi.FOOD_PR_CHARGES,
          xi.NON_MEMBER_PROFIT,
          xi.PR_CHARGES
        FROM xxafmc_inventory xi
        WHERE
          (xi.CATEGORY_ID = 10 AND xi.SUB_CATEGORY NOT IN (14, 15))
          OR (xi.CATEGORY_ID = 14 AND xi.SUB_CATEGORY IN (7, 10))
      ) pricing_data
      WHERE category_name IS NOT NULL
      GROUP BY category_name
      ORDER BY FIELD(category_name, 'Liquor', 'Snacks');
    `;

    const [rows] = await pool.query(query);

    return res.status(200).json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("Error in getPricingReport:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching pricing report",
    });
  }
};