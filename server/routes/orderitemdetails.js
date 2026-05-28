const express = require("express");
const db = require("../config/db");

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

  const baseQuery = `
    SELECT 
        od.item_id,
        SUM(od.quantity) AS quantity,
        IFNULL(SUM(od.subtotal), 0) AS subtotal,
        
        CASE 
            WHEN IFNULL(SUM(od.subtotal),0) > 0 THEN  
                (SUM(CASE WHEN od.subtotal > 0 THEN od.subtotal ELSE 0 END) -
                 SUM(CASE WHEN od.subtotal > 0 THEN IFNULL(od.food_pr_charges, 0) * od.quantity ELSE 0 END)) / 
                 (1 + (MAX(IFNULL(od.profit, 0)) / 100))
            ELSE 0
        END AS price,

        SUM(CASE 
                WHEN od.subtotal > 0 
                THEN IFNULL(od.food_pr_charges,0) * od.quantity 
                ELSE 0 
            END) AS food_pr_charges,

        SUM(CASE 
                WHEN od.subtotal > 0 
                THEN IFNULL(od.profit,0) * od.quantity 
                ELSE 0 
            END) AS totalprofit,

        CASE 
            WHEN IFNULL(SUM(od.subtotal),0) > 0 THEN  
                (MAX(IFNULL(od.profit, 0)) / 100) * (
                    (SUM(CASE WHEN od.subtotal > 0 THEN od.subtotal ELSE 0 END) -
                     SUM(CASE WHEN od.subtotal > 0 THEN IFNULL(od.food_pr_charges, 0) * od.quantity ELSE 0 END)) /
                     (1 + (MAX(IFNULL(od.profit, 0)) / 100))
                )
            ELSE 0
        END AS total_profit,

        CASE 
            WHEN IFNULL(SUM(od.subtotal),0) > 0 THEN  
                ((MAX(IFNULL(od.profit, 0)) / 100) * (
                    (SUM(CASE WHEN od.subtotal > 0 THEN od.subtotal ELSE 0 END) -
                     SUM(CASE WHEN od.subtotal > 0 THEN IFNULL(od.food_pr_charges, 0) * od.quantity ELSE 0 END)) /
                     (1 + (MAX(IFNULL(od.profit, 0)) / 100))
                )) / NULLIF(SUM(CASE WHEN od.subtotal > 0 THEN od.quantity END), 0)
            ELSE 0
        END AS unit_profit,

        MAX(oh.order_date) AS order_date,
        xi.item_name

    FROM xxafmc_order_details od
    JOIN xxafmc_order_header oh ON od.order_id = oh.order_num
    JOIN xxafmc_inventory xi ON xi.item_code = od.item_id
    JOIN xxafmc_users xu ON oh.user_id = xu.user_id
    JOIN xxafmc_role r ON xu.role_id = r.role_id
    LEFT JOIN xxafmc_non_members nm ON nm.id = oh.member_id
    LEFT JOIN xxafmc_pubmed xp ON xp.pubmed_id = oh.pubmed

    WHERE 
        TRIM(UPPER(od.payment_status)) = 'PAID'
        AND xi.category_id IN (10, 14)
        AND UPPER(IFNULL(od.order_status, '')) <> 'CANCELLED'
        ${dateFilterClause}
        AND (? IS NULL OR UPPER(COALESCE(nm.first_name, xu.first_name)) = UPPER(?))
        AND (? IS NULL OR UPPER(IFNULL(xp.pubmed_name, '')) = UPPER(?))
        ${itemFilterClause}

    GROUP BY 
        od.item_id,
        xi.item_name
  `;

  const pagedBaseQuery = `
    ${baseQuery}
    ORDER BY order_date DESC, item_id DESC
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
        NULL AS item_name
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
    WHERE TRIM(UPPER(od.payment_status)) = 'PAID'
      AND xi.category_id IN (10, 14)
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
    WHERE TRIM(UPPER(od.payment_status)) = 'PAID'
      AND xi.category_id IN (10, 14)
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
    WHERE TRIM(UPPER(od.payment_status)) = 'PAID'
      AND xi.category_id IN (10, 14)
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


