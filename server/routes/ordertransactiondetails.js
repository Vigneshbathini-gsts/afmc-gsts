const express = require("express");
const db = require("../config/db");

const router = express.Router();

const normalizeParam = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const normalizeLikeParam = (value) => {
  const normalized = normalizeParam(value);
  return normalized ? `%${normalized.toUpperCase()}%` : null;
};

const normalizeDateParam = (value) => {
  const normalized = normalizeParam(value);
  if (!normalized) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
};

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

const getOrderTransactionDetails = async (req, res) => {
  const fromDate = normalizeDateParam(req.query.fromDate);
  const toDate = normalizeDateParam(req.query.toDate);
  const orderNumberLike = normalizeLikeParam(req.query.orderNumber);
  const userNameLike = normalizeLikeParam(req.query.userName);
  const kitchenNameLike = normalizeLikeParam(req.query.kitchenName);
  const itemNameLike = normalizeLikeParam(req.query.itemNames);

  const dateFilterClause = buildDateFilterClause(
    "OH.ORDER_DATE_NEW",
    fromDate,
    toDate
  );

  const baseWhere = `
    WHERE 
      TRIM(UPPER(OD.PAYMENT_STATUS)) = 'PAID'
      ${dateFilterClause}
      AND (? IS NULL OR CAST(OD.ORDER_ID AS CHAR) LIKE ?)
      AND (
        ? IS NULL
        OR UPPER(TRIM(IFNULL(COALESCE(XNM.FIRST_NAME, XU.FIRST_NAME), ''))) LIKE ?
        OR UPPER(TRIM(CONCAT_WS(' ', IFNULL(XNM.FIRST_NAME, XU.FIRST_NAME), IFNULL(XNM.LAST_NAME, '')))) LIKE ?
        OR UPPER(TRIM(CONCAT_WS(' ', IFNULL(XU.FIRST_NAME, ''), IFNULL(XU.LAST_NAME, '')))) LIKE ?
      )
      AND (? IS NULL OR UPPER(TRIM(IFNULL(XP.PUBMED_NAME, ''))) LIKE ?)
      AND (? IS NULL OR UPPER(TRIM(IFNULL(XI.ITEM_NAME, ''))) LIKE ?)
  `;

  const detailQuery = `
    SELECT 
      OD.ORDER_LINE_ID,
      OD.ORDER_ID,
      OD.ITEM_ID,
      OD.QUANTITY,

      ROUND(OD.SUBTOTAL, 2) AS SUBTOTAL,

      ROUND(
        CASE 
          WHEN OD.SUBTOTAL <> 0 THEN  
            (OD.SUBTOTAL - IFNULL(OD.FOOD_PR_CHARGES * OD.QUANTITY, 0)) 
            / (1 + (IFNULL(OD.PROFIT, 0) / 100)) / OD.QUANTITY
          ELSE 0
        END, 2
      ) AS PRICE,

      ROUND(IFNULL(OD.FOOD_PR_CHARGES * OD.QUANTITY, 0), 2) AS FOOD_PR_CHARGES,

      IFNULL(OD.PROFIT * OD.QUANTITY, 0) AS TOTALPROFIT,

      ROUND(
        (IFNULL(OD.PROFIT, 0) / 100) *
        ((OD.SUBTOTAL - IFNULL(OD.FOOD_PR_CHARGES * OD.QUANTITY, 0)) /
        (1 + (IFNULL(OD.PROFIT, 0) / 100))), 2
      ) AS TOTAL_PROFIT,

      ROUND(
        ((IFNULL(OD.PROFIT, 0) / 100) *
        ((OD.SUBTOTAL - IFNULL(OD.FOOD_PR_CHARGES * OD.QUANTITY, 0)) /
        (1 + (IFNULL(OD.PROFIT, 0) / 100)))) / OD.QUANTITY, 2
      ) AS UNIT_PROFIT,

      OH.ORDER_NUM,
      OH.USER_ID,
      OH.ORDER_DATE_NEW AS O_DATE,
      OH.ORDER_TOTAL,

      CONCAT(UCASE(LEFT(XI.ITEM_NAME,1)), LCASE(SUBSTRING(XI.ITEM_NAME,2))) AS ITEM_NAME,

      COALESCE(XNM.FIRST_NAME, XU.FIRST_NAME) AS FIRST_NAME,
      XP.PUBMED_NAME,

      1 AS ORD

    FROM xxafmc_order_details OD
    JOIN xxafmc_order_header OH ON OD.ORDER_ID = OH.ORDER_NUM

    LEFT JOIN xxafmc_inventory XI ON XI.ITEM_CODE = OD.ITEM_ID
    LEFT JOIN xxafmc_users XU ON OH.USER_ID = XU.USER_ID
    LEFT JOIN xxafmc_role R ON XU.ROLE_ID = R.ROLE_ID
    LEFT JOIN xxafmc_pubmed XP ON XP.PUBMED_ID = OH.PUBMED
    LEFT JOIN xxafmc_non_members XNM ON XNM.ID = OH.MEMBER_ID

    ${baseWhere}
  `;

  const summaryQuery = `
    SELECT 
      NULL AS ORDER_LINE_ID,
      NULL AS ORDER_ID,
      NULL AS ITEM_ID,
      'Total' AS QUANTITY,

      ROUND(SUM(OD.SUBTOTAL),2) AS SUBTOTAL,
      NULL AS PRICE,

      ROUND(SUM(IFNULL(OD.FOOD_PR_CHARGES * OD.QUANTITY,0)),2) AS FOOD_PR_CHARGES,

      SUM(IFNULL(OD.PROFIT * OD.QUANTITY,0)) AS TOTALPROFIT,

      ROUND(SUM(
        (IFNULL(OD.PROFIT, 0) / 100) *
        ((OD.SUBTOTAL - IFNULL(OD.FOOD_PR_CHARGES * OD.QUANTITY, 0)) /
        (1 + (IFNULL(OD.PROFIT, 0) / 100)))
      ),2) AS TOTAL_PROFIT,

      NULL AS UNIT_PROFIT,
      NULL AS ORDER_NUM,
      NULL AS USER_ID,
      NULL AS O_DATE,
      NULL AS ORDER_TOTAL,
      NULL AS ITEM_NAME,
      NULL AS FIRST_NAME,
      NULL AS PUBMED_NAME,

      2 AS ORD

    FROM xxafmc_order_details OD
    JOIN xxafmc_order_header OH ON OD.ORDER_ID = OH.ORDER_NUM

    LEFT JOIN xxafmc_inventory XI ON XI.ITEM_CODE = OD.ITEM_ID
    LEFT JOIN xxafmc_users XU ON OH.USER_ID = XU.USER_ID
    LEFT JOIN xxafmc_pubmed XP ON XP.PUBMED_ID = OH.PUBMED
    LEFT JOIN xxafmc_non_members XNM ON XNM.ID = OH.MEMBER_ID

    ${baseWhere}
  `;

  const finalQuery = `
    SELECT * FROM (
      ${detailQuery}
      UNION ALL
      ${summaryQuery}
    ) final
    ORDER BY ORD ASC, ORDER_NUM DESC
  `;

  const dateValues = buildDateValues(fromDate, toDate);

  const baseValues = [
    ...dateValues,
    orderNumberLike,
    orderNumberLike,
    userNameLike,
    userNameLike,
    userNameLike,
    userNameLike,
    kitchenNameLike,
    kitchenNameLike,
    itemNameLike,
    itemNameLike,
  ];

  const values = [...baseValues, ...baseValues];

  try {
    const [results] = await db.execute(finalQuery, values);

    return res.json({
      success: true,
      count: results.length,
      data: results,
    });
  } catch (error) {
    console.error("Order Transaction Error:", error);

    return res.status(500).json({
      success: false,
      message: "Error fetching order transactions",
      error: error.message,
    });
  }
};

const getOrderTransactionFilterOptions = async (req, res) => {
  const fromDate = normalizeDateParam(req.query.fromDate);
  const toDate = normalizeDateParam(req.query.toDate);

  const dateFilterClause = buildDateFilterClause(
    "oh.order_date_new",
    fromDate,
    toDate
  );
  const dateValues = buildDateValues(fromDate, toDate);

  const itemQuery = `
    SELECT DISTINCT TRIM(xi.item_name) AS value
    FROM xxafmc_order_details od
    JOIN xxafmc_order_header oh ON od.order_id = oh.order_num
    LEFT JOIN xxafmc_inventory xi ON xi.item_code = od.item_id
    WHERE TRIM(UPPER(od.payment_status)) = 'PAID'
      ${dateFilterClause}
      AND xi.item_name IS NOT NULL
      AND TRIM(xi.item_name) <> ''
    ORDER BY TRIM(xi.item_name) ASC
  `;

  const userQuery = `
    SELECT DISTINCT TRIM(COALESCE(xnm.first_name, xu.first_name)) AS value
    FROM xxafmc_order_details od
    JOIN xxafmc_order_header oh ON od.order_id = oh.order_num
    LEFT JOIN xxafmc_users xu ON oh.user_id = xu.user_id
    LEFT JOIN xxafmc_non_members xnm ON xnm.id = oh.member_id
    WHERE TRIM(UPPER(od.payment_status)) = 'PAID'
      ${dateFilterClause}
      AND COALESCE(xnm.first_name, xu.first_name) IS NOT NULL
      AND TRIM(COALESCE(xnm.first_name, xu.first_name)) <> ''
    ORDER BY value ASC
  `;

  const kitchenQuery = `
    SELECT DISTINCT TRIM(xp.pubmed_name) AS value
    FROM xxafmc_order_details od
    JOIN xxafmc_order_header oh ON od.order_id = oh.order_num
    LEFT JOIN xxafmc_pubmed xp ON xp.pubmed_id = oh.pubmed
    WHERE TRIM(UPPER(od.payment_status)) = 'PAID'
      ${dateFilterClause}
      AND xp.pubmed_name IS NOT NULL
      AND TRIM(xp.pubmed_name) <> ''
    ORDER BY TRIM(xp.pubmed_name) ASC
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
    console.error("Order Transaction Filter Options Error:", error);

    return res.status(500).json({
      success: false,
      message: "Error fetching order transaction filter options",
      error: error.message,
    });
  }
};

router.get("/ordertransaction", getOrderTransactionDetails);
router.get("/order-transaction", getOrderTransactionDetails);
router.get("/ordertransaction/filter-options", getOrderTransactionFilterOptions);
router.get("/order-transaction/filter-options", getOrderTransactionFilterOptions);

module.exports = router;
