const express = require("express");
const db = require("../config/db");
const {
  isExcludedLiquorSubcategory,
  NON_ALCOHOLIC_LIQUOR_SUBCATEGORY_IDS,
} = require("../helpers/pricingHelper");

const router = express.Router();

const normalizeParam = (value) => {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
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

const parsePagination = (query) => {
  const parsedLimit = parseInt(query.limit, 10);
  const parsedOffset = parseInt(query.offset, 10);

  return {
    limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 20,
    offset: Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0,
  };
};

const getOrderTransactionDetails = async (req, res) => {
  try {
    const fromDate = normalizeDateParam(req.query.fromDate);
    const toDate = normalizeDateParam(req.query.toDate);
    const orderNumberExact = normalizeParam(req.query.orderNumber);
    const userNameExact = normalizeExactParam(req.query.userName);
    const kitchenNameExact = normalizeExactParam(req.query.kitchenName);
    const itemNameExact = normalizeExactParam(req.query.itemNames);
    const { limit, offset } = parsePagination(req.query);

    const dateFilterClause = buildDateFilterClause(
      "OH.ORDER_DATE",
      fromDate,
      toDate
    );

    const dateValues = buildDateValues(fromDate, toDate);

    let baseWhere = `
      WHERE 
        TRIM(UPPER(OD.PAYMENT_STATUS)) = 'PAID'
        AND XI.CATEGORY_ID IN (10, 14)
        AND UPPER(IFNULL(OD.ORDER_STATUS, '')) <> 'CANCELLED'
        ${dateFilterClause}
    `;

    if (orderNumberExact) {
      baseWhere += ` AND CAST(OD.ORDER_ID AS CHAR) = ?`;
    } else {
      baseWhere += ` AND (? IS NULL OR CAST(OD.ORDER_ID AS CHAR) = ?)`;
    }

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

    if (kitchenNameExact) {
      baseWhere += ` AND UPPER(TRIM(IFNULL(XP.PUBMED_NAME, ''))) = ?`;
    } else {
      baseWhere += ` AND (? IS NULL OR UPPER(TRIM(IFNULL(XP.PUBMED_NAME, ''))) = ?)`;
    }

    if (itemNameExact) {
      baseWhere += ` AND UPPER(TRIM(IFNULL(XI.ITEM_NAME, ''))) = ?`;
    } else {
      baseWhere += ` AND (? IS NULL OR UPPER(TRIM(IFNULL(XI.ITEM_NAME, ''))) = ?)`;
    }

    const scannedTotalsJoin = `
      LEFT JOIN (
        SELECT
          order_number,
          inventory_item_code,
          ROUND(SUM(IFNULL(scan_quantity, 0) * IFNULL(item_price, 0)), 2) AS scanned_subtotal
        FROM order_scan_collection
        WHERE collection_name = 'S_COLLECTION'
        GROUP BY order_number, inventory_item_code
      ) ST
        ON ST.order_number = OD.ORDER_ID
        AND ST.inventory_item_code = OD.ITEM_ID
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
      ) CT
        ON CT.order_number = OD.ORDER_ID
        AND CT.inventory_item_code = OD.ITEM_ID
    `;

    const multiplierExpression = `
      CASE WHEN UPPER(TRIM(IFNULL(OD.TYPE, ''))) = 'LARGE' THEN 2 ELSE 1 END
    `;

    const effectiveProfitExpression = `
      CASE
        WHEN XI.CATEGORY_ID = 10 AND XI.SUB_CATEGORY IN (${NON_ALCOHOLIC_LIQUOR_SUBCATEGORY_IDS.join(", ")})
          THEN 0
        ELSE IFNULL(OD.PROFIT, 0)
      END
    `;

    // For cocktails: ingredient total from scanned totals or subtotal
    const ingredientTotalExpression = `
      CASE
        WHEN IFNULL(ST.scanned_subtotal, 0) > 0 THEN ST.scanned_subtotal
        WHEN IFNULL(CT.unit_custom_subtotal, 0) > 0 THEN CT.unit_custom_subtotal * (${multiplierExpression} * IFNULL(OD.QUANTITY, 0))
        ELSE IFNULL(OD.SUBTOTAL, 0) * (${multiplierExpression})
      END
    `;

    // FIX: For cocktails, subtotal = ingredient total + prep charge (once per order line)
    // For regular items, subtotal = ingredient total (no prep charge)
    const subtotalExpression = `
      CASE
        WHEN XI.SUB_CATEGORY IN (14, 15) THEN 
          ${ingredientTotalExpression} + IFNULL(OD.FOOD_PR_CHARGES, 0)
        ELSE 
          ${ingredientTotalExpression} - IFNULL(OD.FOOD_PR_CHARGES * (${multiplierExpression} * IFNULL(OD.QUANTITY, 0)), 0)
      END
    `;

    // FIX: For cocktails, show the actual prep charge (15)
    // For regular items, show the prep charge multiplied by quantity
    const foodPrChargesExpression = `
      CASE
        WHEN XI.SUB_CATEGORY IN (14, 15) THEN IFNULL(OD.FOOD_PR_CHARGES, 0)
        ELSE IFNULL(OD.FOOD_PR_CHARGES * (${multiplierExpression} * IFNULL(OD.QUANTITY, 0)), 0)
      END
    `;

    const quantityExpression = `
      (${multiplierExpression} * IFNULL(OD.QUANTITY, 0))
    `;

    const detailQuery = `
      SELECT DISTINCT
        OD.ORDER_LINE_ID,
        OD.ORDER_ID,
        OD.ITEM_ID,
        OD.TYPE AS TYPE,
        ${quantityExpression} AS QUANTITY,
        ROUND(${subtotalExpression}, 2) AS SUBTOTAL,
        ROUND(
          CASE 
            WHEN ${subtotalExpression} <> 0 THEN
              (${subtotalExpression})
              / (1 + ((${effectiveProfitExpression}) / 100)) / NULLIF(${multiplierExpression} * IFNULL(OD.QUANTITY, 0), 0)
            ELSE 0
          END, 2
        ) AS PRICE,
        ROUND(${foodPrChargesExpression}, 2) AS FOOD_PR_CHARGES,
        (${effectiveProfitExpression}) * (${multiplierExpression} * IFNULL(OD.QUANTITY, 0)) AS TOTALPROFIT,
        ROUND(
          ((${effectiveProfitExpression}) / 100) *
          ((${subtotalExpression}) /
          (1 + ((${effectiveProfitExpression}) / 100))), 2
        ) AS TOTAL_PROFIT,
        ROUND(
          (((${effectiveProfitExpression}) / 100) *
          ((${subtotalExpression}) /
          (1 + ((${effectiveProfitExpression}) / 100)))) / NULLIF(${multiplierExpression} * IFNULL(OD.QUANTITY, 0), 0), 2
        ) AS UNIT_PROFIT,
        (${effectiveProfitExpression}) AS TOTALPERCENT,
        OH.ORDER_NUM,
        OH.USER_ID,
        OH.ORDER_DATE AS O_DATE,
        OH.ORDER_TOTAL,
        CONCAT(UCASE(LEFT(XI.ITEM_NAME,1)), LCASE(SUBSTRING(XI.ITEM_NAME,2))) AS ITEM_NAME,
        COALESCE(XNM.FIRST_NAME, XU.FIRST_NAME) AS FIRST_NAME,
        XP.PUBMED_NAME,
        1 AS ORD
      FROM xxafmc_order_details OD
      JOIN xxafmc_order_header OH ON OD.ORDER_ID = OH.ORDER_NUM
      JOIN xxafmc_inventory XI ON XI.ITEM_CODE = OD.ITEM_ID
      LEFT JOIN xxafmc_users XU ON OH.USER_ID = XU.USER_ID
      LEFT JOIN xxafmc_pubmed XP ON XP.PUBMED_ID = OH.PUBMED
      LEFT JOIN xxafmc_non_members XNM ON XNM.ID = OH.MEMBER_ID
      ${scannedTotalsJoin}
      ${customTotalsJoin}
      ${baseWhere}
      ORDER BY OH.ORDER_NUM DESC, OD.ORDER_LINE_ID DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const summaryQuery = `
      SELECT 
        NULL AS ORDER_LINE_ID,
        NULL AS ORDER_ID,
        NULL AS ITEM_ID,
        NULL AS TYPE,
        'Total' AS QUANTITY,
        ROUND(SUM(${subtotalExpression}),2) AS SUBTOTAL,
        NULL AS PRICE,
        ROUND(SUM(${foodPrChargesExpression}),2) AS FOOD_PR_CHARGES,
        SUM((${effectiveProfitExpression}) * (${multiplierExpression} * IFNULL(OD.QUANTITY, 0))) AS TOTALPROFIT,
        ROUND(SUM(
          ((${effectiveProfitExpression}) / 100) *
          ((${subtotalExpression}) /
          (1 + ((${effectiveProfitExpression}) / 100)))
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
      JOIN xxafmc_inventory XI ON XI.ITEM_CODE = OD.ITEM_ID
      LEFT JOIN xxafmc_users XU ON OH.USER_ID = XU.USER_ID
      LEFT JOIN xxafmc_pubmed XP ON XP.PUBMED_ID = OH.PUBMED
      LEFT JOIN xxafmc_non_members XNM ON XNM.ID = OH.MEMBER_ID
      ${scannedTotalsJoin}
      ${customTotalsJoin}
      ${baseWhere}
    `;

    const finalQuery = `
      SELECT * FROM (
        (${detailQuery})
        UNION ALL
        (${summaryQuery})
      ) final
      ORDER BY ORD ASC, ORDER_NUM DESC
    `;

    const params = [];
    params.push(...dateValues);

    if (orderNumberExact) {
      params.push(orderNumberExact);
    } else {
      params.push(null, null);
    }

    if (userNameExact) {
      params.push(userNameExact, userNameExact, userNameExact);
    } else {
      params.push(null, null, null, null);
    }

    if (kitchenNameExact) {
      params.push(kitchenNameExact);
    } else {
      params.push(null, null);
    }

    if (itemNameExact) {
      params.push(itemNameExact);
    } else {
      params.push(null, null);
    }

    const allParams = [...params, ...params];

    const [results] = await db.execute(finalQuery, allParams);

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