const express = require("express");
const db = require("../config/db");
const { NON_ALCOHOLIC_LIQUOR_SUBCATEGORY_IDS } = require("../helpers/pricingHelper");

const router = express.Router();

// ------------------ Helpers ------------------
const normalizeParam = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const normalizeItemNames = (value) => {
  const normalized = normalizeParam(value);
  if (!normalized) return [];

  return normalized
    .split(":")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
};

const normalizeDateParam = (value) => {
  const normalized = normalizeParam(value);
  if (!normalized) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
};

const buildInClause = (items) => items.map(() => "?").join(", ");

const buildDateFilterClause = (columnName, fromDate, toDate) => {
  if (fromDate && toDate) {
    return `AND DATE(${columnName}) BETWEEN ? AND ?`;
  }

  if (fromDate) {
    return `AND DATE(${columnName}) >= ?`;
  }

  if (toDate) {
    return `AND DATE(${columnName}) <= ?`;
  }

  return "";
};

const buildDateValues = (fromDate, toDate) => {
  if (fromDate && toDate) return [fromDate, toDate];
  if (fromDate) return [fromDate];
  if (toDate) return [toDate];
  return [];
};

const parsePagination = (query) => {
  const parsedLimit = parseInt(query.limit, 10);
  const parsedOffset = parseInt(query.offset, 10);

  return {
    limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 20,
    offset: Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0,
  };
};

// ------------------ Controller ------------------
const getOrderItemDetails = async (req, res) => {
  const fromDate = normalizeDateParam(req.query.fromDate);
  const toDate = normalizeDateParam(req.query.toDate);
  const userName = normalizeParam(req.query.userName);
  const kitchenName = normalizeParam(req.query.kitchenName);
  const itemNames = normalizeItemNames(req.query.itemNames);
  const { limit, offset } = parsePagination(req.query);

  const itemFilterClause = itemNames.length
    ? `AND UPPER(xi.item_name) IN (${buildInClause(itemNames)})`
    : "";

  const dateFilterClause = buildDateFilterClause(
    "oh.order_date",
    fromDate,
    toDate
  );

  const scannedTotalsJoin = `
    LEFT JOIN (
      SELECT
        order_line_id,
        ROUND(SUM(IFNULL(scan_quantity, 0) * IFNULL(item_price, 0)), 2) AS scanned_subtotal
      FROM order_scan_collection
      WHERE collection_name = 'S_COLLECTION'
      GROUP BY order_line_id
    ) st
      ON st.order_line_id = od.ORDER_LINE_ID
  `;

  const customTotalsJoin = `
    LEFT JOIN (
      SELECT
        cm.order_number,
        cm.inventory_item_code,
        ROUND(SUM(
          IFNULL(cm.pegs, 0) *
          (
            IFNULL(stock_prices.base_peg_price, 0) * (1 + IFNULL(od_price.profit, 0) / 100) +
            IFNULL(od_price.food_pr_charges, 0)
          )
        ), 2) AS unit_custom_subtotal
      FROM xxafmc_custom_cocktails_mocktails_details cm
      JOIN xxafmc_order_details od_price
        ON od_price.order_id = cm.order_number
        AND od_price.item_id = cm.inventory_item_code
      LEFT JOIN (
        SELECT
          item_code,
          MAX(IFNULL(unit_price, 0) / IFNULL(NULLIF(pegs, 0), 1)) AS base_peg_price
        FROM xxafmc_stock_out
        WHERE IFNULL(stock_quantity, 0) > 0
        GROUP BY item_code
      ) stock_prices
        ON stock_prices.item_code = cm.item_code
      GROUP BY cm.order_number, cm.inventory_item_code
    ) ct
      ON ct.order_number = od.order_id
      AND ct.inventory_item_code = od.item_id
  `;

  const multiplierExpression = `
    CASE WHEN UPPER(TRIM(IFNULL(od.TYPE, ''))) = 'LARGE' THEN 2 ELSE 1 END
  `;

  // NEW: profit is forced to 0 for non-alcoholic liquor sub-categories
  // (soft drinks / mixers etc. filed under category_id = 10) so no markup
  // is reported for items that shouldn't carry a liquor profit margin.
  const effectiveProfitExpression = `
    CASE
      WHEN xi.category_id = 10 AND xi.sub_category IN (${NON_ALCOHOLIC_LIQUOR_SUBCATEGORY_IDS.join(", ")})
        THEN 0
      ELSE IFNULL(od.profit, 0)
    END
  `;

  const effectiveSubtotalExpression = `
    CASE
      WHEN xi.sub_category IN (14, 15) AND IFNULL(st.scanned_subtotal, 0) > 0
        THEN st.scanned_subtotal
      WHEN xi.sub_category IN (14, 15) AND IFNULL(ct.unit_custom_subtotal, 0) > 0
        THEN ct.unit_custom_subtotal * (${multiplierExpression} * IFNULL(od.quantity, 0))
      ELSE IFNULL(od.subtotal, 0) * (${multiplierExpression})
    END
  `;

  const effectiveQuantityExpression = `
    (${multiplierExpression} * IFNULL(od.quantity, 0))
  `;

  const baseQuery = `
    SELECT 
        od.item_id,
        SUM(${effectiveQuantityExpression}) AS quantity,
        IFNULL(SUM(${effectiveSubtotalExpression}), 0) AS subtotal,
        
        CASE 
            WHEN IFNULL(SUM(${effectiveSubtotalExpression}),0) > 0 THEN
                (SUM(CASE WHEN ${effectiveSubtotalExpression} > 0 THEN ${effectiveSubtotalExpression} ELSE 0 END) -
                 SUM(CASE WHEN ${effectiveSubtotalExpression} > 0 THEN IFNULL(od.food_pr_charges, 0) * (${effectiveQuantityExpression}) ELSE 0 END)) /
                 (1 + (MAX(${effectiveProfitExpression}) / 100))
            ELSE 0
        END AS price,

        SUM(CASE 
                WHEN ${effectiveSubtotalExpression} > 0
                THEN IFNULL(od.food_pr_charges,0) * (${effectiveQuantityExpression}) 
                ELSE 0 
            END) AS food_pr_charges,

        SUM(CASE 
                WHEN ${effectiveSubtotalExpression} > 0
                THEN (${effectiveProfitExpression}) * (${effectiveQuantityExpression}) 
                ELSE 0 
            END) AS totalprofit,

        CASE 
            WHEN IFNULL(SUM(${effectiveSubtotalExpression}),0) > 0 THEN
                (MAX(${effectiveProfitExpression}) / 100) * (
                    (SUM(CASE WHEN ${effectiveSubtotalExpression} > 0 THEN ${effectiveSubtotalExpression} ELSE 0 END) -
                     SUM(CASE WHEN ${effectiveSubtotalExpression} > 0 THEN IFNULL(od.food_pr_charges, 0) * (${effectiveQuantityExpression}) ELSE 0 END)) /
                     (1 + (MAX(${effectiveProfitExpression}) / 100))
                )
            ELSE 0
        END AS total_profit,

        CASE 
            WHEN IFNULL(SUM(${effectiveSubtotalExpression}),0) > 0 THEN
                ((MAX(${effectiveProfitExpression}) / 100) * (
                    (SUM(CASE WHEN ${effectiveSubtotalExpression} > 0 THEN ${effectiveSubtotalExpression} ELSE 0 END) -
                     SUM(CASE WHEN ${effectiveSubtotalExpression} > 0 THEN IFNULL(od.food_pr_charges, 0) * (${effectiveQuantityExpression}) ELSE 0 END)) /
                     (1 + (MAX(${effectiveProfitExpression}) / 100))
                )) / NULLIF(SUM(CASE WHEN ${effectiveSubtotalExpression} > 0 THEN (${effectiveQuantityExpression}) END), 0)
            ELSE 0
        END AS unit_profit,

        MAX(oh.order_date) AS order_date,
        xi.item_name,
        od.TYPE AS TYPE,
        od.TYPE AS peg_type

    FROM xxafmc_order_details od
    JOIN xxafmc_order_header oh ON od.order_id = oh.order_num
    JOIN xxafmc_inventory xi ON xi.item_code = od.item_id
    JOIN xxafmc_users xu ON oh.user_id = xu.user_id
    JOIN xxafmc_role r ON xu.role_id = r.role_id
    LEFT JOIN xxafmc_non_members nm ON nm.id = oh.member_id
    LEFT JOIN xxafmc_pubmed xp ON xp.pubmed_id = oh.pubmed
    ${scannedTotalsJoin}
    ${customTotalsJoin}

    WHERE 
        xi.category_id IN (10, 14)
        AND UPPER(IFNULL(od.order_status, '')) <> 'CANCELLED'
        ${dateFilterClause}
        AND (? IS NULL OR UPPER(COALESCE(nm.first_name, xu.first_name)) = UPPER(?))
        AND (? IS NULL OR UPPER(IFNULL(xp.pubmed_name, '')) = UPPER(?))
        ${itemFilterClause}

    GROUP BY 
        od.item_id,
        xi.item_name,
        od.TYPE
  `;

  const pagedBaseQuery = `
    ${baseQuery}
    ORDER BY order_date DESC, item_id DESC, peg_type ASC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const totalQuery = `
    SELECT 
        NULL AS item_id,
        'Total' AS quantity,
        ROUND(SUM(subtotal), 2) AS subtotal,
        NULL AS price,
        ROUND(SUM(food_pr_charges), 2) AS food_pr_charges,
        ROUND(SUM(totalprofit), 2) AS totalprofit,
        ROUND(SUM(total_profit), 2) AS total_profit,
        NULL AS unit_profit,
        NULL AS order_date,
        NULL AS item_name,
        NULL AS TYPE,
        NULL AS peg_type
    FROM (${baseQuery}) a
  `;

  // ------------------ Values ------------------
  const dateValues = buildDateValues(fromDate, toDate);

  const baseValues = [
    ...dateValues,
    userName,
    userName,
    kitchenName,
    kitchenName,
    ...itemNames,
  ];

  try {
    const [[detailRows], [totalRows]] = await Promise.all([
      db.execute(pagedBaseQuery, baseValues),
      db.execute(totalQuery, baseValues),
    ]);
    const totalRow = totalRows?.[0] || null;
    const results = totalRow ? [...detailRows, totalRow] : detailRows;

    return res.json({
      success: true,
      count: results.length,
      data: results,
    });
  } catch (error) {
    console.error("Order Item Details Error:", error);

    return res.status(500).json({
      success: false,
      message: "Error fetching data",
      error: error.message,
    });
  }
};

const getOrderItemFilterOptions = async (req, res) => {
  const fromDate = normalizeDateParam(req.query.fromDate);
  const toDate = normalizeDateParam(req.query.toDate);

  const dateFilterClause = buildDateFilterClause(
    "oh.order_date",
    fromDate,
    toDate
  );
  const dateValues = buildDateValues(fromDate, toDate);

  const itemQuery = `
    SELECT DISTINCT xi.item_name AS value
    FROM xxafmc_order_details od
    JOIN xxafmc_order_header oh ON od.order_id = oh.order_num
    JOIN xxafmc_inventory xi ON xi.item_code = od.item_id
    WHERE xi.category_id IN (10, 14)
      AND UPPER(IFNULL(od.order_status, '')) <> 'CANCELLED'
      ${dateFilterClause}
      AND xi.item_name IS NOT NULL
      AND TRIM(xi.item_name) <> ''
    ORDER BY xi.item_name ASC
  `;

  const userQuery = `
    SELECT DISTINCT COALESCE(nm.first_name, xu.first_name) AS value
    FROM xxafmc_order_details od
    JOIN xxafmc_order_header oh ON od.order_id = oh.order_num
    JOIN xxafmc_inventory xi ON xi.item_code = od.item_id
    JOIN xxafmc_users xu ON oh.user_id = xu.user_id
    LEFT JOIN xxafmc_non_members nm ON nm.id = oh.member_id
    WHERE xi.category_id IN (10, 14)
      AND UPPER(IFNULL(od.order_status, '')) <> 'CANCELLED'
      ${dateFilterClause}
      AND COALESCE(nm.first_name, xu.first_name) IS NOT NULL
      AND TRIM(COALESCE(nm.first_name, xu.first_name)) <> ''
    ORDER BY value ASC
  `;

  const kitchenQuery = `
    SELECT DISTINCT xp.pubmed_name AS value
    FROM xxafmc_order_details od
    JOIN xxafmc_order_header oh ON od.order_id = oh.order_num
    JOIN xxafmc_inventory xi ON xi.item_code = od.item_id
    LEFT JOIN xxafmc_pubmed xp ON xp.pubmed_id = oh.pubmed
    WHERE xi.category_id IN (10, 14)
      AND UPPER(IFNULL(od.order_status, '')) <> 'CANCELLED'
      ${dateFilterClause}
      AND xp.pubmed_name IS NOT NULL
      AND TRIM(xp.pubmed_name) <> ''
    ORDER BY xp.pubmed_name ASC
  `;

  try {
    const [[itemRows], [userRows], [kitchenRows]] = await Promise.all([
      db.execute(itemQuery, dateValues),
      db.execute(userQuery, dateValues),
      db.execute(kitchenQuery, dateValues),
    ]);

    return res.json({
      success: true,
      data: {
        itemNames: itemRows.map((row) => row.value),
        userNames: userRows.map((row) => row.value),
        kitchenNames: kitchenRows.map((row) => row.value),
      },
    });
  } catch (error) {
    console.error("Order Item Filter Options Error:", error);

    return res.status(500).json({
      success: false,
      message: "Error fetching order item filter options",
      error: error.message,
    });
  }
};

// ------------------ Routes ------------------
router.get("/orderitem", getOrderItemDetails);
router.get("/order-item", getOrderItemDetails);
router.get("/orderitem/filter-options", getOrderItemFilterOptions);
router.get("/order-item/filter-options", getOrderItemFilterOptions);

module.exports = router;