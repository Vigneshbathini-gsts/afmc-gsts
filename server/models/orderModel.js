const db = require("../config/db");
const { getStartOfDay, getEndOfDay } = require("../utils/dateUtils");

// ─── Shared SQL fragments ───────────────────────────────────────────────
// Reused by the admin order history summary as well as the order-wise /
// item-wise detail reports so that pricing (scanned barcode pricing,
// custom cocktail/mocktail pricing, and plain subtotal) stays consistent
// everywhere a rupee amount is calculated.

// Per-order-line joins that resolve scanned pricing and custom
// cocktail/mocktail pricing for a given `od` (xxafmc_order_details) alias.
const LINE_PRICING_JOINS = `
  LEFT JOIN (
    SELECT
      order_number,
      inventory_item_code,
      order_line_id,
      ROUND(SUM(IFNULL(scan_quantity, 0) * IFNULL(item_price, 0)), 2) AS scanned_total
    FROM order_scan_collection
    WHERE collection_name = 'S_COLLECTION'
    GROUP BY order_number, inventory_item_code, order_line_id
  ) scanned_totals
    ON scanned_totals.order_number = od.order_id
    AND scanned_totals.inventory_item_code = od.item_id
    AND (scanned_totals.order_line_id = od.order_line_id OR scanned_totals.order_line_id IS NULL)
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
      ), 2) AS unit_custom_total
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
  ) custom_totals
    ON custom_totals.order_number = od.order_id
    AND custom_totals.inventory_item_code = od.item_id
`;

// Per-order-line unit price (excludes cancelled lines).
const LINE_PRICE_CASE = `
  CASE
    WHEN TRIM(UPPER(IFNULL(od.order_status, ''))) = 'CANCELLED' THEN 0
    WHEN scanned_totals.scanned_total > 0 AND (od.price IS NULL OR od.price <> 0) THEN scanned_totals.scanned_total / NULLIF(od.quantity, 0)
    WHEN custom_totals.unit_custom_total > 0 THEN custom_totals.unit_custom_total
    ELSE COALESCE(od.price, od.subtotal / NULLIF(od.quantity, 0), 0)
  END
`;

const LINE_DISPLAY_PRICE_CASE = `
  (${LINE_PRICE_CASE} - IFNULL(od.food_pr_charges, 0))
`;

// Per-order-line subtotal (excludes cancelled lines).
// FIX: For cocktails (subcategory 14 or 15), subtotal already includes prep charge
const LINE_SUBTOTAL_CASE = `
  CASE
    WHEN TRIM(UPPER(IFNULL(od.order_status, ''))) = 'CANCELLED' THEN 0
    WHEN od.subcategory IN (14, 15) THEN IFNULL(od.subtotal, 0)
    WHEN scanned_totals.scanned_total > 0 AND (od.price IS NULL OR od.price <> 0) THEN
      scanned_totals.scanned_total +
      (IFNULL(od.food_pr_charges, 0) * IFNULL(od.quantity, 0))
    WHEN custom_totals.unit_custom_total > 0 THEN custom_totals.unit_custom_total * od.quantity
    ELSE IFNULL(od.subtotal, 0)
  END
`;

// Per-order correlated subtotal (used against xxoh.order_num).
// FIX: For cocktails (subcategory 14 or 15), subtotal already includes prep charge
const ORDER_SUBTOTAL_SUBQUERY = `
  (
    SELECT SUM(
      CASE
        WHEN TRIM(UPPER(IFNULL(xxod2.order_status, ''))) = 'CANCELLED' THEN 0
        WHEN xxod2.subcategory IN (14, 15) THEN IFNULL(xxod2.subtotal, 0)
        WHEN scanned_totals.scanned_total > 0 AND (xxod2.price IS NULL OR xxod2.price <> 0) THEN
          scanned_totals.scanned_total +
          (IFNULL(xxod2.food_pr_charges, 0) * IFNULL(xxod2.quantity, 0))
        WHEN custom_totals.unit_custom_total > 0 THEN custom_totals.unit_custom_total * xxod2.quantity
        ELSE COALESCE(xxod2.subtotal, 0)
      END
    )
    FROM xxafmc_order_details xxod2
    LEFT JOIN (
      SELECT
        order_number,
        inventory_item_code,
        order_line_id,
        ROUND(SUM(IFNULL(scan_quantity, 0) * IFNULL(item_price, 0)), 2) AS scanned_total
      FROM order_scan_collection
      WHERE collection_name = 'S_COLLECTION'
      GROUP BY order_number, inventory_item_code, order_line_id
    ) scanned_totals
      ON scanned_totals.order_number = xxod2.order_id
      AND scanned_totals.inventory_item_code = xxod2.item_id
      AND (scanned_totals.order_line_id = xxod2.order_line_id OR scanned_totals.order_line_id IS NULL)
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
        ), 2) AS unit_custom_total
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
    ) custom_totals
      ON custom_totals.order_number = xxod2.order_id
      AND custom_totals.inventory_item_code = xxod2.item_id
    WHERE xxod2.order_id = xxoh.order_num
      AND TRIM(UPPER(IFNULL(xxod2.order_status, ''))) != 'CANCELLED'
  )
`;

const REPORT_COLLATION = "utf8mb4_unicode_ci";
const reportText = (expression) =>
  `CONVERT(${expression} USING utf8mb4) COLLATE ${REPORT_COLLATION}`;

// An order counts as "history-eligible" (matches Page 81 logic) when every
// kitchen-notification line for it is Completed, OR when it has a mix of
// Completed and Cancelled lines (i.e. nothing is still Pending/Preparing).
const COMPLETED_ORDER_FILTER = `
  SELECT ordernumber
  FROM xxafmc_kitchen_notification
  GROUP BY ordernumber
  HAVING
    COUNT(*) = SUM(CASE WHEN ${reportText("status")} = ${reportText("'Completed'")} THEN 1 ELSE 0 END)
    OR (
      SUM(CASE WHEN ${reportText("status")} = ${reportText("'Completed'")} THEN 1 ELSE 0 END) > 0
      AND SUM(CASE WHEN ${reportText("status")} = ${reportText("'Cancelled'")} THEN 1 ELSE 0 END) > 0
    )
`;

const ORDER_DATE_EXPR = `
  DATE(COALESCE(STR_TO_DATE(xxoh.order_date, '%m/%d/%Y'), DATE(xxoh.order_date)))
`;

const toSqlDateOnly = (value) => {
  if (!value) return null;
  const raw = String(value).trim();

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const normalizeReportUsername = (value) => {
  const clean = value?.trim() || null;
  if (!clean) return null;
  return clean.replace(/\s+non\s*member$/i, "").trim() || clean;
};

const reportCustomerName = (headerAlias) => `
  COALESCE(
    ${reportText(`(SELECT NULLIF(TRIM(first_name), '') FROM xxafmc_non_members WHERE id = ${headerAlias}.member_id)`)},
    ${reportText(`(SELECT NULLIF(TRIM(first_name), '') FROM xxafmc_users WHERE user_id = ${headerAlias}.user_id)`)},
    ${reportText(`CONCAT('Order ', ${headerAlias}.order_num)`)}
  )
`;
const reportPaymentStatus = (invoiceAlias = "inv") => `
  COALESCE(${reportText(`${invoiceAlias}.payment_status`)}, ${reportText("'Un Paid'")})
`;
const reportItemName = `
  COALESCE(${reportText("NULLIF(xi.item_name, '')")}, ${reportText("CAST(od.item_id AS CHAR)")})
`;
const reportItemType = (detailTypeExpression = "od.type") => `
  COALESCE(${reportText(`NULLIF(${detailTypeExpression}, '')`)}, ${reportText("NULLIF(xi.type, '')")}, ${reportText("'NA'")})
`;

/**
 * Admin Order History (Page 81 equivalent).
 */
async function getAdminOrderHistory({
  from = null,
  to = null,
  username = null,
  userId = null,
}) {
  const fromDate = toSqlDateOnly(from);
  const toDate = toSqlDateOnly(to);
  const requestedUser = normalizeReportUsername(username);
  const activeUserId = userId || null;

  const query = `
    WITH base AS (
      SELECT
        xxoh.order_num,
        ${ORDER_DATE_EXPR} AS order_date,
        ${reportText("CASE WHEN xxoh.member_id IS NOT NULL THEN CONCAT('M:', xxoh.member_id) ELSE CONCAT('U:', xxoh.user_id) END")} AS member_key,
        MAX(${reportCustomerName("xxoh")}) AS first_name,
        COALESCE(MAX(${reportText("inv.payment_status")}), ${reportText("'Un Paid'")}) AS payment_status,
        COALESCE(
          ${reportText("CONCAT(UCASE(LEFT(MAX(inv.payment_method), 1)), LCASE(SUBSTRING(MAX(inv.payment_method), 2)))")},
          ${reportText("''")}
        ) AS payment_method,
        ROUND(COALESCE(${ORDER_SUBTOTAL_SUBQUERY}, 0), 2) AS order_subtotal
      FROM xxafmc_order_header xxoh
      JOIN xxafmc_kitchen_notification xxkn
        ON xxoh.order_num = xxkn.ordernumber
      JOIN xxafmc_users xu
        ON xxkn.user_name = xu.user_id
      LEFT JOIN xxafmc_invoices inv
        ON inv.order_num = xxoh.order_num
      WHERE xxoh.order_num IN (${COMPLETED_ORDER_FILTER})
        AND (? IS NULL OR xxoh.user_id = ?)
        AND (? IS NULL OR ${ORDER_DATE_EXPR} >= DATE(?))
        AND (? IS NULL OR ${ORDER_DATE_EXPR} <= DATE(?))
      GROUP BY xxoh.order_num, xxoh.order_date, xxoh.member_id, xxoh.user_id
      HAVING ? IS NULL OR ? = '' OR LOCATE(UPPER(${reportText("?")}), UPPER(first_name)) > 0
    )
    SELECT * FROM (
      SELECT
        DATE_FORMAT(order_date, '%c/%e/%Y') AS order_date,
        DATE_FORMAT(order_date, '%Y-%m-%d') AS order_date_iso,
        MAX(first_name) AS first_name,
        ${reportText("'Completed'")} AS status,
        MAX(payment_method) AS payment_method,
        ${reportText("'Paid'")} AS payment_status1,
        1 AS ord,
        ROUND(SUM(order_subtotal), 2) AS subtotal
      FROM base
      WHERE payment_status = ${reportText("'Paid'")}
      GROUP BY order_date, member_key
      HAVING SUM(order_subtotal) > 0

      UNION ALL

      SELECT
        DATE_FORMAT(order_date, '%c/%e/%Y') AS order_date,
        DATE_FORMAT(order_date, '%Y-%m-%d') AS order_date_iso,
        MAX(first_name) AS first_name,
        ${reportText("'Completed'")} AS status,
        MAX(payment_method) AS payment_method,
        ${reportText("'Un Paid'")} AS payment_status1,
        1 AS ord,
        ROUND(SUM(order_subtotal), 2) AS subtotal
      FROM base
      WHERE payment_status = ${reportText("'Un Paid'")}
      GROUP BY order_date, member_key
      HAVING SUM(order_subtotal) > 0

      UNION ALL

      SELECT
        NULL AS order_date,
        NULL AS order_date_iso,
        NULL AS first_name,
        NULL AS status,
        NULL AS payment_method,
        ${reportText("'Total (Unpaid)'")} AS payment_status1,
        2 AS ord,
        ROUND(SUM(order_subtotal), 2) AS subtotal
      FROM base
      WHERE payment_status = ${reportText("'Un Paid'")}
      HAVING SUM(order_subtotal) > 0
    ) summary
    ORDER BY ord ASC, order_date_iso DESC, first_name ASC
  `;

  const params = [
    activeUserId,
    activeUserId,
    fromDate,
    fromDate,
    toDate,
    toDate,
    requestedUser,
    requestedUser,
    requestedUser,
  ];

  const [rows] = await db.execute(query, params);
  return rows;
}

async function getOrderHistoryUserOptions() {
  const query = `
    SELECT DISTINCT first_name AS value, first_name AS label
    FROM (
      SELECT ${reportCustomerName("xxoh")} AS first_name
      FROM xxafmc_order_header xxoh
      WHERE ${reportCustomerName("xxoh")} IS NOT NULL
    ) names
    WHERE first_name IS NOT NULL AND TRIM(first_name) <> ''
    ORDER BY first_name ASC
  `;

  const [rows] = await db.execute(query);
  return rows;
}

/**
 * Order-wise report (Page 82 equivalent — "order wise" view).
 */
async function getOrderWiseReport({
  orderDate,
  username = null,
  paymentStatus = null,
  userId = null,
}) {
  const query = `
    SELECT * FROM (
      SELECT
        od.order_line_id,
        od.order_id AS order_num,
        od.item_id,
        ${reportItemName} AS item_name,
        ${reportItemType("od.type")} AS type,
        od.quantity,
        ROUND(${LINE_PRICE_CASE}, 2) AS price,
        ROUND(
          CASE
            WHEN TRIM(UPPER(IFNULL(od.order_status, ''))) = 'CANCELLED' THEN 0
            WHEN EXISTS (
              SELECT 1
              FROM xxafmc_inventory flag_inventory
              WHERE flag_inventory.item_code = od.item_id
                AND TRIM(UPPER(IFNULL(flag_inventory.FLAG, ''))) = 'N'
            ) THEN 0
            -- For cocktails: prep charge is food_pr_charges (once per order line)
            WHEN od.subcategory IN (14, 15) THEN IFNULL(od.food_pr_charges, 0)
            -- For regular items: prep charge is food_pr_charges * quantity
            ELSE IFNULL(od.food_pr_charges, 0) * od.quantity
          END,
          2
        ) AS prep_charges,
        ROUND(${LINE_SUBTOTAL_CASE}, 2) AS subtotal,
        ROUND(
          CASE
            WHEN TRIM(UPPER(IFNULL(od.order_status, ''))) = 'CANCELLED' THEN 0
            -- Calculate profit: (subtotal - prep_charges) * (profit_percent / (100 + profit_percent))
            WHEN od.subcategory IN (14, 15) THEN
              (${LINE_SUBTOTAL_CASE} - IFNULL(od.food_pr_charges, 0)) * 
              (IFNULL(od.profit, 0) / (100 + IFNULL(od.profit, 0)))
            ELSE
              (${LINE_SUBTOTAL_CASE} - (IFNULL(od.food_pr_charges, 0) * od.quantity)) * 
              (IFNULL(od.profit, 0) / (100 + IFNULL(od.profit, 0)))
          END,
          2
        ) AS profit,
        ${reportText("xxkn.status")} AS status,
        1 AS sort_order
      FROM xxafmc_order_details od
      JOIN xxafmc_order_header xoh
        ON od.order_id = xoh.order_num
      JOIN xxafmc_kitchen_notification xxkn
        ON xxkn.ordernumber = od.order_id
        AND xxkn.item_id = od.item_id
      JOIN xxafmc_users xu
        ON xxkn.user_name = xu.user_id
      LEFT JOIN xxafmc_invoices inv
        ON inv.order_num = xoh.order_num
      LEFT JOIN xxafmc_inventory xi
        ON xi.item_code = od.item_id
      ${LINE_PRICING_JOINS}
      WHERE DATE(COALESCE(STR_TO_DATE(xoh.order_date, '%m/%d/%Y'), DATE(xoh.order_date))) = ?
        AND ${reportText("xxkn.status")} = ${reportText("'Completed'")}
        AND (? IS NULL OR xoh.user_id = ?)
        AND (
          ? IS NULL
          OR UPPER(${reportPaymentStatus("inv")}) = UPPER(${reportText("?")})
        )
        AND (
          ? IS NULL OR ? = ''
          OR UPPER(
            ${reportCustomerName("xoh")}
          ) = UPPER(${reportText("?")})
        )
      GROUP BY od.order_line_id, od.order_id, od.item_id, xi.item_name, xi.type, od.type,
        od.quantity, od.price, od.subtotal, od.order_status, xxkn.status,
        scanned_totals.scanned_total, custom_totals.unit_custom_total,
        od.subcategory, od.food_pr_charges, od.profit

      UNION ALL

      SELECT
        NULL, NULL, NULL, NULL, NULL, NULL, NULL,
        ROUND(SUM(t.prep_charges), 2) AS prep_charges,
        ROUND(SUM(t.subtotal), 2) AS subtotal,
        ROUND(SUM(t.profit), 2) AS profit,
        ${reportText("'Total'")} AS status,
        2 AS sort_order
      FROM (
        SELECT DISTINCT
          od.order_line_id,
          CASE
            WHEN TRIM(UPPER(IFNULL(od.order_status, ''))) = 'CANCELLED' THEN 0
            WHEN EXISTS (
              SELECT 1
              FROM xxafmc_inventory flag_inventory
              WHERE flag_inventory.item_code = od.item_id
                AND TRIM(UPPER(IFNULL(flag_inventory.FLAG, ''))) = 'N'
            ) THEN 0
            WHEN od.subcategory IN (14, 15) THEN IFNULL(od.food_pr_charges, 0)
            ELSE IFNULL(od.food_pr_charges, 0) * od.quantity
          END AS prep_charges,
          ${LINE_SUBTOTAL_CASE} AS subtotal,
          CASE
            WHEN TRIM(UPPER(IFNULL(od.order_status, ''))) = 'CANCELLED' THEN 0
            WHEN od.subcategory IN (14, 15) THEN
              (${LINE_SUBTOTAL_CASE} - IFNULL(od.food_pr_charges, 0)) * 
              (IFNULL(od.profit, 0) / (100 + IFNULL(od.profit, 0)))
            ELSE
              (${LINE_SUBTOTAL_CASE} - (IFNULL(od.food_pr_charges, 0) * od.quantity)) * 
              (IFNULL(od.profit, 0) / (100 + IFNULL(od.profit, 0)))
          END AS profit
        FROM xxafmc_order_details od
        JOIN xxafmc_order_header xoh
          ON od.order_id = xoh.order_num
        JOIN xxafmc_kitchen_notification xxkn
          ON xxkn.ordernumber = od.order_id
          AND xxkn.item_id = od.item_id
        LEFT JOIN xxafmc_invoices inv
          ON inv.order_num = xoh.order_num
        ${LINE_PRICING_JOINS}
        WHERE DATE(COALESCE(STR_TO_DATE(xoh.order_date, '%m/%d/%Y'), DATE(xoh.order_date))) = ?
          AND ${reportText("xxkn.status")} = ${reportText("'Completed'")}
          AND (? IS NULL OR xoh.user_id = ?)
          AND (
            ? IS NULL
            OR UPPER(${reportPaymentStatus("inv")}) = UPPER(${reportText("?")})
          )
          AND (
            ? IS NULL OR ? = ''
            OR UPPER(
              ${reportCustomerName("xoh")}
            ) = UPPER(${reportText("?")})
          )
      ) t
    ) final_data
    ORDER BY sort_order ASC, order_num DESC, item_name ASC
  `;

  const cleanDate = toSqlDateOnly(orderDate);
  const cleanUser = normalizeReportUsername(username);
  const cleanPaymentStatus = paymentStatus?.trim() || null;
  const activeUserId = userId || null;

  const params = [
    cleanDate, activeUserId, activeUserId,
    cleanPaymentStatus, cleanPaymentStatus,
    cleanUser, cleanUser, cleanUser,

    cleanDate, activeUserId, activeUserId,
    cleanPaymentStatus, cleanPaymentStatus,
    cleanUser, cleanUser, cleanUser,
  ];

  const [rows] = await db.execute(query, params);
  return rows;
}

/**
 * Item-wise report aggregated per item.
 */
async function getItemWiseReport({
  orderDate,
  username = null,
  paymentStatus = null,
  userId = null,
}) {
  const query = `
    SELECT * FROM (
      SELECT
        od.item_id,
        ${reportItemName} AS item_name,
        ${reportItemType("od.type")} AS type,
        SUM(od.quantity) AS quantity,
        ROUND(AVG(${LINE_PRICE_CASE}), 2) AS price,
        ROUND(
          SUM(
            CASE
              WHEN TRIM(UPPER(IFNULL(od.order_status, ''))) = 'CANCELLED' THEN 0
              WHEN EXISTS (
                SELECT 1
                FROM xxafmc_inventory flag_inventory
                WHERE flag_inventory.item_code = od.item_id
                  AND TRIM(UPPER(IFNULL(flag_inventory.FLAG, ''))) = 'N'
              ) THEN 0
              WHEN od.subcategory IN (14, 15) THEN IFNULL(od.food_pr_charges, 0)
              ELSE IFNULL(od.food_pr_charges, 0) * od.quantity
            END
          ), 2
        ) AS prep_charges,
        ROUND(
          SUM(
            CASE
              WHEN TRIM(UPPER(IFNULL(od.order_status, ''))) = 'CANCELLED' THEN 0
              WHEN od.subcategory IN (14, 15) THEN
                (${LINE_SUBTOTAL_CASE} - IFNULL(od.food_pr_charges, 0)) * 
                (IFNULL(od.profit, 0) / (100 + IFNULL(od.profit, 0)))
              ELSE
                (${LINE_SUBTOTAL_CASE} - (IFNULL(od.food_pr_charges, 0) * od.quantity)) * 
                (IFNULL(od.profit, 0) / (100 + IFNULL(od.profit, 0)))
            END
          ), 2
        ) AS profit,
        ROUND(SUM(${LINE_SUBTOTAL_CASE}), 2) AS subtotal,
        ${reportText("'Completed'")} AS status,
        1 AS sort_order
      FROM xxafmc_order_details od
      JOIN xxafmc_order_header xoh
        ON od.order_id = xoh.order_num
      JOIN (
        SELECT DISTINCT ordernumber, item_id, user_name, status
        FROM xxafmc_kitchen_notification
      ) xxkn
        ON xxkn.ordernumber = od.order_id
        AND xxkn.item_id = od.item_id
      JOIN xxafmc_users xu
        ON xxkn.user_name = xu.user_id
      LEFT JOIN xxafmc_invoices inv
        ON inv.order_num = xoh.order_num
      LEFT JOIN xxafmc_inventory xi
        ON xi.item_code = od.item_id
      ${LINE_PRICING_JOINS}
      WHERE DATE(COALESCE(STR_TO_DATE(xoh.order_date, '%m/%d/%Y'), DATE(xoh.order_date))) = ?
        AND ${reportText("xxkn.status")} = ${reportText("'Completed'")}
        AND (? IS NULL OR xoh.user_id = ?)
        AND (
          ? IS NULL
          OR UPPER(${reportPaymentStatus("inv")}) = UPPER(${reportText("?")})
        )
        AND (
          ? IS NULL OR ? = ''
          OR UPPER(
            ${reportCustomerName("xoh")}
          ) = UPPER(${reportText("?")})
        )
      GROUP BY od.item_id, xi.item_name, xi.type, od.type, od.subcategory

      UNION ALL

      SELECT
        NULL, NULL, NULL, NULL, NULL,
        ROUND(SUM(t.prep_charges), 2) AS prep_charges,
        ROUND(SUM(t.profit), 2) AS profit,
        ROUND(SUM(t.subtotal), 2) AS subtotal,
        ${reportText("'Total'")} AS status,
        2 AS sort_order
      FROM (
        SELECT DISTINCT
          od.order_line_id,
          CASE
            WHEN TRIM(UPPER(IFNULL(od.order_status, ''))) = 'CANCELLED' THEN 0
            WHEN EXISTS (
              SELECT 1
              FROM xxafmc_inventory flag_inventory
              WHERE flag_inventory.item_code = od.item_id
                AND TRIM(UPPER(IFNULL(flag_inventory.FLAG, ''))) = 'N'
            ) THEN 0
            WHEN od.subcategory IN (14, 15) THEN IFNULL(od.food_pr_charges, 0)
            ELSE IFNULL(od.food_pr_charges, 0) * od.quantity
          END AS prep_charges,
          CASE
            WHEN TRIM(UPPER(IFNULL(od.order_status, ''))) = 'CANCELLED' THEN 0
            WHEN od.subcategory IN (14, 15) THEN
              (${LINE_SUBTOTAL_CASE} - IFNULL(od.food_pr_charges, 0)) * 
              (IFNULL(od.profit, 0) / (100 + IFNULL(od.profit, 0)))
            ELSE
              (${LINE_SUBTOTAL_CASE} - (IFNULL(od.food_pr_charges, 0) * od.quantity)) * 
              (IFNULL(od.profit, 0) / (100 + IFNULL(od.profit, 0)))
          END AS profit,
          ${LINE_SUBTOTAL_CASE} AS subtotal
        FROM xxafmc_order_details od
        JOIN xxafmc_order_header xoh
          ON od.order_id = xoh.order_num
        JOIN xxafmc_kitchen_notification xxkn
          ON xxkn.ordernumber = od.order_id
          AND xxkn.item_id = od.item_id
        LEFT JOIN xxafmc_invoices inv
          ON inv.order_num = xoh.order_num
        ${LINE_PRICING_JOINS}
        WHERE DATE(COALESCE(STR_TO_DATE(xoh.order_date, '%m/%d/%Y'), DATE(xoh.order_date))) = ?
          AND ${reportText("xxkn.status")} = ${reportText("'Completed'")}
          AND (? IS NULL OR xoh.user_id = ?)
          AND (
            ? IS NULL
            OR UPPER(${reportPaymentStatus("inv")}) = UPPER(${reportText("?")})
          )
          AND (
            ? IS NULL OR ? = ''
            OR UPPER(
              ${reportCustomerName("xoh")}
            ) = UPPER(${reportText("?")})
          )
      ) t
    ) final_data
    ORDER BY sort_order ASC, item_name ASC, type ASC
  `;

  const cleanDate = toSqlDateOnly(orderDate);
  const cleanUser = normalizeReportUsername(username);
  const cleanPaymentStatus = paymentStatus?.trim() || null;
  const activeUserId = userId || null;

  const params = [
    cleanDate, activeUserId, activeUserId,
    cleanPaymentStatus, cleanPaymentStatus,
    cleanUser, cleanUser, cleanUser,

    cleanDate, activeUserId, activeUserId,
    cleanPaymentStatus, cleanPaymentStatus,
    cleanUser, cleanUser, cleanUser,
  ];

  const [rows] = await db.execute(query, params);
  // console.log("Fetched Item-wise Report:", rows);
  return rows;
}

async function getActiveOrders({
  from = null,
  to = null,
  search = null,
  appUser = null,
  userId = null,
}) {
  const query = `
   SELECT
  oh.order_num,

  DATE_FORMAT(oh.order_date, '%c/%e/%Y') AS order_date,
  oh.order_date AS creation_date,

  COALESCE(NULLIF(TRIM(MAX(nm.first_name)), ''), NULLIF(TRIM(MAX(customer.first_name)), ''), CONCAT('Order ', oh.order_num)) AS first_name,
  COALESCE(NULLIF(TRIM(MAX(nm.phone_number)), ''), NULLIF(TRIM(MAX(customer.phone_number)), ''), '') AS phone_number,

  ROUND(MAX(oh.order_total), 2) AS order_total,

  CASE
    WHEN SUM(CASE WHEN UPPER(IFNULL(od.order_status,'')) = 'CANCELLED' THEN 1 ELSE 0 END)
         = COUNT(DISTINCT od.order_line_id)
      THEN 'Cancelled'

    WHEN SUM(CASE WHEN kn.status = 'Preparing' THEN 1 ELSE 0 END) > 0
      THEN 'Preparing'

    WHEN SUM(CASE WHEN kn.status = 'Received' THEN 1 ELSE 0 END) > 0
      THEN 'Received'

    WHEN SUM(CASE WHEN kn.status = 'Completed' THEN 1 ELSE 0 END) > 0
      THEN 'Completed'

    ELSE 'Pending'
  END AS status

FROM xxafmc_order_header oh

JOIN xxafmc_order_details od
  ON od.order_id = oh.order_num

LEFT JOIN xxafmc_kitchen_notification kn
  ON kn.ordernumber = od.order_id
 AND kn.item_id = od.item_id

LEFT JOIN xxafmc_users customer
  ON customer.user_id = oh.user_id

LEFT JOIN xxafmc_non_members nm
  ON nm.id = oh.member_id

LEFT JOIN xxafmc_users attendant
  ON attendant.user_id = kn.user_name

WHERE
  (
    ? IS NULL OR oh.order_date >= ?
  )
  AND (
    ? IS NULL OR oh.order_date <= ?
  )

  AND (
    ? IS NULL OR UPPER(attendant.user_name) = UPPER(?)
  )

  AND (
    ? IS NULL OR oh.user_id = ?
  )

  AND (
    ? IS NULL
    OR CAST(oh.order_num AS CHAR) LIKE ?
    OR UPPER(COALESCE(nm.first_name, customer.first_name, '')) LIKE UPPER(?)
    OR COALESCE(nm.phone_number, customer.phone_number, '') LIKE ?
  )

GROUP BY oh.order_num, oh.order_date

HAVING status IN ('Received', 'Preparing', 'Pending')

ORDER BY creation_date DESC, oh.order_num DESC;
  `;

  const fromDate = from ? getStartOfDay(from) : null;
  const toDate = to ? getEndOfDay(to) : null;
  const searchTerm = search?.trim() || null;
  const searchLike = searchTerm ? `%${searchTerm}%` : null;
  const normalizedAppUser = appUser?.trim() || null;
  const normalizedUserId = userId || null;

  const [rows] = await db.execute(query, [
    fromDate, fromDate,
    toDate, toDate,
    normalizedAppUser, normalizedAppUser,
    normalizedUserId, normalizedUserId,
    searchTerm,
    searchLike,
    searchLike,
    searchLike,
  ]);

  return rows;
}

/**
 * Get order details with subtotal including preparation charges for cocktails
 */
async function getOrderDetails(orderNumber, { includeCancelled = false } = {}) {
  const query = `
  SELECT
    od.order_line_id,
    od.order_id AS order_num,
    od.item_id,
    COALESCE(xi.item_name, od.item_id) AS item_name,
    od.quantity,
    ROUND(
      CASE
        WHEN TRIM(UPPER(IFNULL(od.order_status, ''))) = 'CANCELLED' THEN 0
        -- For cocktails, calculate price from subtotal
        WHEN od.subcategory IN (14, 15) THEN 
          ROUND(IFNULL(od.subtotal, 0) / NULLIF(od.quantity, 0), 2)
        WHEN scanned_totals.scanned_total > 0 AND (od.price IS NULL OR od.price <> 0) THEN 
          ROUND(scanned_totals.scanned_total / NULLIF(od.quantity, 0), 2)
        WHEN custom_totals.unit_custom_total > 0 THEN custom_totals.unit_custom_total
        ELSE COALESCE(od.price, ROUND(od.subtotal / NULLIF(od.quantity, 0), 2), 0)
      END,
      2
    ) AS price,
    ROUND(
      CASE
        WHEN TRIM(UPPER(IFNULL(od.order_status, ''))) = 'CANCELLED' THEN 0
        -- For cocktails, subtotal already includes prep charge
        WHEN od.subcategory IN (14, 15) THEN IFNULL(od.subtotal, 0)
        WHEN scanned_totals.scanned_total > 0 AND (od.price IS NULL OR od.price <> 0) THEN 
          scanned_totals.scanned_total +
          (IFNULL(od.food_pr_charges, 0) * IFNULL(od.quantity, 0))
        WHEN custom_totals.unit_custom_total > 0 THEN 
          custom_totals.unit_custom_total * od.quantity
        ELSE 
          IFNULL(od.subtotal, 0)
      END,
      2
    ) AS subtotal,
    COALESCE(NULLIF(xi.type, ''), NULLIF(od.type, ''), 'NA') AS type,
    CASE
      WHEN TRIM(UPPER(IFNULL(od.order_status, ''))) = 'CANCELLED' THEN 'Cancelled'
      WHEN EXISTS (
        SELECT 1
        FROM xxafmc_kitchen_notification kn
        WHERE kn.ordernumber = od.order_id
          AND TRIM(CAST(kn.item_id AS CHAR)) = TRIM(CAST(od.item_id AS CHAR))
          AND kn.status = 'Preparing'
      ) THEN 'Preparing'
      WHEN EXISTS (
        SELECT 1
        FROM xxafmc_kitchen_notification kn
        WHERE kn.ordernumber = od.order_id
          AND TRIM(CAST(kn.item_id AS CHAR)) = TRIM(CAST(od.item_id AS CHAR))
          AND kn.status = 'Received'
      ) THEN 'Received'
      WHEN EXISTS (
        SELECT 1
        FROM xxafmc_kitchen_notification kn
        WHERE kn.ordernumber = od.order_id
          AND TRIM(CAST(kn.item_id AS CHAR)) = TRIM(CAST(od.item_id AS CHAR))
          AND kn.status = 'Completed'
      ) THEN 'Completed'
      WHEN TRIM(UPPER(IFNULL(od.order_status, ''))) = 'COMPLETED' THEN 'Completed'
      ELSE 'Received'
    END AS status,
    od.barcode AS barcode,
    od.FREE_ITEM_CODE AS free_item_code,
    od.FREE_ITEM_QUANTITY AS free_item_quantity,
    od.profit AS profit,
    od.food_pr_charges AS prep_charges,
    od.subcategory AS subcategory,
    xi.category_id AS category_id,
    xi.inventory_flag AS inventory_flag
  FROM xxafmc_order_details od
  LEFT JOIN (
      SELECT
        order_number,
        inventory_item_code,
        order_line_id,
        ROUND(SUM(IFNULL(scan_quantity, 0) * IFNULL(item_price, 0)), 2) AS scanned_total
      FROM order_scan_collection
      WHERE collection_name = 'S_COLLECTION'
      GROUP BY order_number, inventory_item_code, order_line_id
  ) scanned_totals
    ON scanned_totals.order_number = od.order_id
    AND scanned_totals.inventory_item_code = od.item_id
    AND (scanned_totals.order_line_id = od.order_line_id OR scanned_totals.order_line_id IS NULL)
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
        ), 2) AS unit_custom_total
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
  ) custom_totals
    ON custom_totals.order_number = od.order_id
    AND custom_totals.inventory_item_code = od.item_id
  LEFT JOIN (
      SELECT 
        item_code,
        MAX(item_name) AS item_name,
        MAX(type) AS type,
        MAX(category_id) AS category_id,
        MAX(flag) AS inventory_flag
      FROM xxafmc_inventory
      GROUP BY item_code
  ) xi
    ON xi.item_code = od.item_id
  WHERE od.order_id = ?
    AND (? OR TRIM(UPPER(IFNULL(od.order_status, ''))) != 'CANCELLED')
  ORDER BY od.order_line_id ASC;
  `;

  const [rows] = await db.execute(query, [orderNumber, includeCancelled]);
  // console.log("Order Details Query Result:", rows);
  return rows;
}

/**
 * Get order summary using order_total from header
 */
async function getOrderSummary(orderNumber) {
  const query = `
    SELECT
      xxoh.order_num,
      ROUND(IFNULL(xxoh.order_total, 0), 2) AS totalAmount,
      DATE_FORMAT(STR_TO_DATE(xxoh.order_date, '%m/%d/%Y'), '%c/%e/%Y') AS orderDate,
      IFNULL(MAX(inv.payment_method), '') AS paymentMethod,
      IFNULL(MAX(inv.payment_status), 'Un Paid') AS paymentStatus
    FROM xxafmc_order_header xxoh
    LEFT JOIN xxafmc_invoices inv
      ON inv.order_num = xxoh.order_num
    WHERE xxoh.order_num = ?
    GROUP BY xxoh.order_num, xxoh.order_total, xxoh.order_date
  `;

  const [rows] = await db.execute(query, [orderNumber]);
  // console.log("Order Summary Query Result:", rows);
  return rows[0] || null;
}

async function getNonMemberByPhone(phoneNumber) {
  const [rows] = await db.execute(
    `
      SELECT
        id,
        first_name,
        last_name,
        phone_number
      FROM xxafmc_non_members
      WHERE phone_number = ?
      LIMIT 1
    `,
    [phoneNumber]
  );

  return rows[0] || null;
}

async function saveNonMember({ firstName, lastName = "", phoneNumber }) {
  const normalizedFirstName = String(firstName || "").trim();
  const normalizedLastName = String(lastName || "").trim();
  const normalizedPhone = String(phoneNumber || "").trim();

  if (!normalizedFirstName || !normalizedPhone) {
    const error = new Error("Phone number and first name are required.");
    error.code = "INVALID_DATA";
    throw error;
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [existingRows] = await connection.execute(
      `
        SELECT id
        FROM xxafmc_non_members
        WHERE phone_number = ?
        LIMIT 1
      `,
      [normalizedPhone]
    );

    let nonMemberId = existingRows[0]?.id || null;

    if (nonMemberId) {
      await connection.execute(
        `
          UPDATE xxafmc_non_members
          SET first_name = ?, last_name = ?
          WHERE id = ?
        `,
        [normalizedFirstName, normalizedLastName, nonMemberId]
      );
    } else {
      const [[nextIdRow]] = await connection.execute(
        `
          SELECT COALESCE(MAX(id), 0) + 1 AS nextId
          FROM xxafmc_non_members
        `
      );

      nonMemberId = nextIdRow?.nextId;

      await connection.execute(
        `
          INSERT INTO xxafmc_non_members (
            id,
            first_name,
            last_name,
            phone_number
          )
          VALUES (?, ?, ?, ?)
        `,
        [nonMemberId, normalizedFirstName, normalizedLastName, normalizedPhone]
      );
    }

    await connection.commit();

    return getNonMemberByPhone(normalizedPhone);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getUserOrderHistory({ fromDate, toDate, username, appUser }) {
  const query = `
      SELECT  
        xxoh.order_num,
        ROUND(IFNULL(MAX(detail_totals.subtotal), 0), 2) AS subtotal,
        CASE 
          WHEN MAX(CASE WHEN xxkn.status = 'Completed' THEN 1 END) = 1 
          THEN 'Completed'
          WHEN MAX(CASE WHEN xxkn.status = 'Cancelled' THEN 1 END) = 1
          THEN 'Cancelled'
        END AS status,
        DATE_FORMAT(MAX(xxod.creation_date), '%Y-%m-%d %H:%i:%s') AS creation_date,
        MAX(
          COALESCE(
            (SELECT NULLIF(TRIM(xnm.first_name), '') FROM xxafmc_non_members xnm WHERE xnm.id = xxoh.member_id), 
            (SELECT NULLIF(TRIM(xu2.first_name), '') FROM xxafmc_users xu2 WHERE xu2.user_id = xxoh.user_id),
            CONCAT('Order ', xxoh.order_num)
          )
        ) AS first_name,
        CASE 
          WHEN MAX(inv.payment_status) = 'Paid' OR MAX(xxod.payment_status) = 'Paid'
          THEN 1
          ELSE 0
        END AS is_paid,
        IFNULL(
          CONCAT(
            UCASE(LEFT(MAX(inv.payment_method), 1)),
            LCASE(SUBSTRING(MAX(inv.payment_method), 2))
          ),
          ''
        ) AS payment_method,
        CASE  
          WHEN MAX(inv.payment_status) IS NOT NULL THEN MAX(inv.payment_status)
          WHEN MAX(xxod.payment_status) IS NULL THEN 'Un Paid'
          ELSE MAX(xxod.payment_status)
        END AS payment_status1
      FROM xxafmc_order_header xxoh
      JOIN xxafmc_order_details xxod ON xxoh.order_num = xxod.order_id
      JOIN xxafmc_inventory xxui ON xxod.item_id = xxui.item_code
      JOIN xxafmc_kitchen_notification xxkn ON xxod.order_id = xxkn.ordernumber
      JOIN xxafmc_users xu ON xxkn.user_name = xu.user_id
      LEFT JOIN xxafmc_invoices inv ON inv.order_num = xxoh.order_num
      LEFT JOIN (
        SELECT
          od.order_id,
          ROUND(SUM(
            CASE
              -- For cocktails (subcategory 14 or 15), subtotal already includes prep charge
              WHEN od.subcategory IN (14, 15) THEN IFNULL(od.subtotal, 0)
              WHEN scanned_totals.scanned_total > 0 AND (od.price IS NULL OR od.price <> 0) THEN
                scanned_totals.scanned_total +
                (IFNULL(od.food_pr_charges, 0) * IFNULL(od.quantity, 0))
              WHEN custom_totals.unit_custom_total > 0 THEN custom_totals.unit_custom_total * od.quantity
              ELSE IFNULL(od.subtotal, 0)
            END
          ), 2) AS subtotal
        FROM xxafmc_order_details od
        LEFT JOIN (
          SELECT
            order_number,
            inventory_item_code,
            order_line_id,
            ROUND(SUM(IFNULL(scan_quantity, 0) * IFNULL(item_price, 0)), 2) AS scanned_total
          FROM order_scan_collection
          WHERE collection_name = 'S_COLLECTION'
          GROUP BY order_number, inventory_item_code, order_line_id
        ) scanned_totals
          ON scanned_totals.order_number = od.order_id
          AND scanned_totals.inventory_item_code = od.item_id
          AND (scanned_totals.order_line_id = od.order_line_id OR scanned_totals.order_line_id IS NULL)
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
            ), 2) AS unit_custom_total
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
        ) custom_totals
          ON custom_totals.order_number = od.order_id
          AND custom_totals.inventory_item_code = od.item_id
        WHERE TRIM(UPPER(IFNULL(od.order_status, ''))) != 'CANCELLED'
        GROUP BY od.order_id
      ) detail_totals
        ON detail_totals.order_id = xxoh.order_num
      WHERE UPPER(xu.user_name) = UPPER(?)
        AND xxoh.order_num IN (
          SELECT ordernumber
          FROM xxafmc_kitchen_notification
          GROUP BY ordernumber
          HAVING 
            COUNT(*) = SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END)
            OR (COUNT(CASE WHEN status = 'Completed' THEN 1 END) > 0 
                AND COUNT(CASE WHEN status = 'Cancelled' THEN 1 END) > 0)
        )
        AND DATE(xxod.creation_date) BETWEEN IFNULL(?, CURDATE()) AND IFNULL(?, CURDATE())
      GROUP BY 
        xxoh.order_num
      ORDER BY 
        MAX(xxod.creation_date) DESC
    `;

  const cleanUser = appUser?.trim() || null;
  const params = [cleanUser, fromDate || null, toDate || null];
  const [rows] = await db.execute(query, params);
  return rows;
}

module.exports = {
  getActiveOrders,
  getAdminOrderHistory,
  getOrderHistoryUserOptions,
  getOrderWiseReport,
  getItemWiseReport,
  getNonMemberByPhone,
  getUserOrderHistory,
  getOrderDetails,
  getOrderSummary,
  saveNonMember,
};