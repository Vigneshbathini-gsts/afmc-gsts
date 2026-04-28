const express = require("express");
const db = require("../config/db");

const router = express.Router();

const normalizeParam = (value) => {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const normalizeLikeParam = (value) => {
  const normalized = normalizeParam(value);
  return normalized ? `%${normalized.toUpperCase()}%` : null;
};

const normalizeExactParam = (value) => {
  const normalized = normalizeParam(value);
  return normalized ? normalized.toUpperCase() : null;
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
  try {
    const fromDate = normalizeDateParam(req.query.fromDate);
    const toDate = normalizeDateParam(req.query.toDate);
    const orderNumberLike = normalizeLikeParam(req.query.orderNumber);
    const userNameExact = normalizeExactParam(req.query.userName);
    const kitchenNameExact = normalizeExactParam(req.query.kitchenName);
    const itemNameExact = normalizeExactParam(req.query.itemNames);

    console.log("Received filters:", {
      fromDate,
      toDate,
      orderNumberLike,
      userNameExact,
      kitchenNameExact,
      itemNameExact,
    });

    const dateFilterClause = buildDateFilterClause(
      "OH.ORDER_DATE_NEW",
      fromDate,
      toDate
    );

    const dateValues = buildDateValues(fromDate, toDate);

    // Base WHERE clause with all filters
    let baseWhere = `
      WHERE 
        TRIM(UPPER(OD.PAYMENT_STATUS)) = 'PAID'
        ${dateFilterClause}
    `;

    // Add order number filter if provided
    if (orderNumberLike) {
      baseWhere += ` AND CAST(OD.ORDER_ID AS CHAR) LIKE ?`;
    } else {
      baseWhere += ` AND (? IS NULL OR CAST(OD.ORDER_ID AS CHAR) LIKE ?)`;
    }

    // Add user name filter if provided
    if (userNameExact) {
      baseWhere += ` AND (
        UPPER(TRIM(IFNULL(COALESCE(XNM.FIRST_NAME, XU.FIRST_NAME), ''))) = ?
        OR UPPER(TRIM(CONCAT_WS(' ', IFNULL(XNM.FIRST_NAME, XU.FIRST_NAME), IFNULL(XNM.LAST_NAME, '')))) = ?
        OR UPPER(TRIM(CONCAT_WS(' ', IFNULL(XU.FIRST_NAME, ''), IFNULL(XU.LAST_NAME, '')))) = ?
      )`;
    } else {
      baseWhere += ` AND (? IS NULL OR (
        UPPER(TRIM(IFNULL(COALESCE(XNM.FIRST_NAME, XU.FIRST_NAME), ''))) = ?
        OR UPPER(TRIM(CONCAT_WS(' ', IFNULL(XNM.FIRST_NAME, XU.FIRST_NAME), IFNULL(XNM.LAST_NAME, '')))) = ?
        OR UPPER(TRIM(CONCAT_WS(' ', IFNULL(XU.FIRST_NAME, ''), IFNULL(XU.LAST_NAME, '')))) = ?
      ))`;
    }

    // Add kitchen name filter if provided
    if (kitchenNameExact) {
      baseWhere += ` AND UPPER(TRIM(IFNULL(XP.PUBMED_NAME, ''))) = ?`;
    } else {
      baseWhere += ` AND (? IS NULL OR UPPER(TRIM(IFNULL(XP.PUBMED_NAME, ''))) = ?)`;
    }

    // Add item name filter if provided
    if (itemNameExact) {
      baseWhere += ` AND UPPER(TRIM(IFNULL(XI.ITEM_NAME, ''))) = ?`;
    } else {
      baseWhere += ` AND (? IS NULL OR UPPER(TRIM(IFNULL(XI.ITEM_NAME, ''))) = ?)`;
    }

    const detailQuery = `
      SELECT DISTINCT
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
        IFNULL(OD.PROFIT, 0) AS TOTALPERCENT,
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
        NULL AS TOTALPERCENT,
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

    // Build parameters array based on which filters are provided
    const params = [];

    // Add date parameters
    params.push(...dateValues);

    // Add order number parameters (2 params for LIKE pattern)
    if (orderNumberLike) {
      params.push(orderNumberLike);
    } else {
      params.push(null, null);
    }

    // Add user name parameters (3 params for different name combinations)
    if (userNameExact) {
      params.push(userNameExact, userNameExact, userNameExact);
    } else {
      params.push(null, null, null, null);
    }

    // Add kitchen name parameters (1 param for exact match)
    if (kitchenNameExact) {
      params.push(kitchenNameExact);
    } else {
      params.push(null, null);
    }

    // Add item name parameters (1 param for exact match)
    if (itemNameExact) {
      params.push(itemNameExact);
    } else {
      params.push(null, null);
    }

    // Duplicate params for the summary query (since it has the same WHERE clause)
    const allParams = [...params, ...params];

    console.log("Query parameters count:", allParams.length);
    console.log("Query parameters:", allParams);

    const [results] = await db.execute(finalQuery, allParams);

    console.log(`Found ${results.length} records`);

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

const mapApexOptions = (rows) => {
  const seen = new Set();
  return rows
    .map((row) => {
      const label = String(row?.D ?? row?.d ?? row?.FIRST_NAME ?? row?.PUBMED_NAME ?? row?.ITEM_NAME ?? "").trim();
      const value = String(row?.R ?? row?.r ?? row?.FIRST_NAME ?? row?.PUBMED_NAME ?? row?.ITEM_NAME ?? "").trim();
      if (!label || !value) return null;
      return { label, value };
    })
    .filter(Boolean)
    .filter((row) => {
      const key = row.value.toUpperCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const sendOptionResponse = async (res, query, errorLabel) => {
  try {
    const [rows] = await db.execute(query);
    return res.json({
      success: true,
      data: mapApexOptions(rows),
    });
  } catch (error) {
    console.error(`${errorLabel} Error:`, error);
    return res.status(500).json({
      success: false,
      message: `Error fetching ${errorLabel.toLowerCase()}`,
      error: error.message,
    });
  }
};

const getOrderTransactionUserOptions = async (req, res) => {
  const query = `
    SELECT DISTINCT first_name AS D, first_name AS R
    FROM xxafmc_users
    WHERE first_name IS NOT NULL AND TRIM(first_name) != ''
    UNION
    SELECT DISTINCT first_name AS D, first_name AS R
    FROM xxafmc_non_members
    WHERE first_name IS NOT NULL AND TRIM(first_name) != ''
    ORDER BY D
  `;
  return sendOptionResponse(res, query, "Order Transaction User Options");
};

const getOrderTransactionKitchenOptions = async (req, res) => {
  const query = `
    SELECT DISTINCT pubmed_name AS D, pubmed_name AS R
    FROM xxafmc_pubmed
    WHERE pubmed_name IS NOT NULL AND TRIM(pubmed_name) != ''
    ORDER BY D
  `;
  return sendOptionResponse(res, query, "Order Transaction Kitchen Options");
};

const getOrderTransactionItemOptions = async (req, res) => {
  const query = `
    SELECT DISTINCT xi.item_name AS D, xi.item_name AS R
    FROM xxafmc_inventory xi
    INNER JOIN xxafmc_order_details od ON xi.item_code = od.item_id
    WHERE xi.item_name IS NOT NULL AND TRIM(xi.item_name) != ''
    ORDER BY D
  `;
  return sendOptionResponse(res, query, "Order Transaction Item Options");
};

router.get("/ordertransaction", getOrderTransactionDetails);
router.get("/order-transaction", getOrderTransactionDetails);
router.get("/ordertransaction/users", getOrderTransactionUserOptions);
router.get("/order-transaction/users", getOrderTransactionUserOptions);
router.get("/ordertransaction/kitchens", getOrderTransactionKitchenOptions);
router.get("/order-transaction/kitchens", getOrderTransactionKitchenOptions);
router.get("/ordertransaction/items", getOrderTransactionItemOptions);
router.get("/order-transaction/items", getOrderTransactionItemOptions);

module.exports = router;