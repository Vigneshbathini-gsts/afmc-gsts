const db = require("../config/db");

const normalizeDate = (value, isEndOfDay = false) => {
  if (!value) {
    return null;
  }

  const suffix = isEndOfDay ? "T23:59:59" : "T00:00:00";
  const parsed = new Date(`${value}${suffix}`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 19).replace("T", " ");
};

async function getAdminOrderHistory({
  from = null,
  to = null,
  username = null,
  appUser = null,
}) {
  const query = `
    SELECT
      order_num,
      first_name,
      status,
      payment_method,
      payment_status1,
      order_date,
      ord,
      subtotal
    FROM (
      SELECT
        xxoh.order_num,
        ROUND(xxoh.order_total, 2) AS subtotal,
        CASE
          WHEN SUM(CASE WHEN xxkn.status = 'Completed' THEN 1 ELSE 0 END) > 0
          THEN 'Completed'
          ELSE 'Pending'
        END AS status,
        DATE_FORMAT(
          STR_TO_DATE(xxoh.order_date, '%m/%d/%Y'),
          '%c/%e/%Y'
        ) AS order_date,
        IFNULL(
          CONCAT(
            UCASE(LEFT(MAX(inv.payment_method), 1)),
            LCASE(SUBSTRING(MAX(inv.payment_method), 2))
          ),
          ''
        ) AS payment_method,
        1 AS ord,
        MAX(
          IFNULL(
            (
              SELECT xnm.first_name
              FROM xxafmc_non_members xnm
              WHERE xnm.id = xxoh.member_id
            ),
            (
              SELECT xu2.first_name
              FROM xxafmc_users xu2
              WHERE xu2.user_id = xxoh.user_id
            )
          )
        ) AS first_name,
        IFNULL(MAX(inv.payment_status), 'Un Paid') AS payment_status1
      FROM xxafmc_order_header xxoh
      JOIN xxafmc_order_details xxod
        ON xxoh.order_num = xxod.order_id
      JOIN xxafmc_kitchen_notification xxkn
        ON xxod.order_id = xxkn.ordernumber
      JOIN xxafmc_users xu
        ON xxkn.user_name = xu.user_id
      LEFT JOIN xxafmc_invoices inv
        ON inv.order_num = xxoh.order_num
      WHERE xxoh.order_num IN (
        SELECT ordernumber
        FROM xxafmc_kitchen_notification
        GROUP BY ordernumber
        HAVING SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) > 0
      )
      AND (
        ? IS NULL
        OR ? = ''
        OR EXISTS (
          SELECT 1
          FROM xxafmc_users
          WHERE UPPER(user_name) = UPPER(?)
            AND role_id = 10
        )
        OR UPPER(xu.user_name) = UPPER(?)
      )
      AND STR_TO_DATE(xxoh.order_date, '%m/%d/%Y') BETWEEN
        COALESCE(?, STR_TO_DATE(xxoh.order_date, '%m/%d/%Y'))
        AND COALESCE(?, STR_TO_DATE(xxoh.order_date, '%m/%d/%Y'))
      AND (
        ? IS NULL
        OR ? = ''
        OR UPPER(
          IFNULL(
            (
              SELECT first_name
              FROM xxafmc_non_members
              WHERE id = xxoh.member_id
            ),
            (
              SELECT first_name
              FROM xxafmc_users
              WHERE user_id = xxoh.user_id
            )
          )
        ) = UPPER(?)
      )
      GROUP BY xxoh.order_num, xxoh.order_total, xxoh.order_date

      UNION ALL

      SELECT
        NULL AS order_num,
        NULL AS first_name,
        NULL AS status,
        NULL AS payment_method,
        'Total' AS payment_status1,
        NULL AS order_date,
        2 AS ord,
        ROUND(IFNULL(SUM(subtotal), 2), 2) AS subtotal
      FROM (
        SELECT xxoh.order_num, xxoh.order_total AS subtotal
        FROM xxafmc_order_header xxoh
        JOIN xxafmc_order_details xxod
          ON xxoh.order_num = xxod.order_id
        JOIN xxafmc_kitchen_notification xxkn
          ON xxod.order_id = xxkn.ordernumber
        JOIN xxafmc_users xu
          ON xxkn.user_name = xu.user_id
        LEFT JOIN xxafmc_invoices inv
          ON inv.order_num = xxoh.order_num
        WHERE IFNULL(inv.payment_status, 'Un Paid') = 'Un Paid'
          AND xxoh.order_num IN (
            SELECT ordernumber
            FROM xxafmc_kitchen_notification
            GROUP BY ordernumber
            HAVING SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) > 0
          )
          AND (
            ? IS NULL
            OR ? = ''
            OR EXISTS (
              SELECT 1
              FROM xxafmc_users
              WHERE UPPER(user_name) = UPPER(?)
                AND role_id = 10
            )
            OR UPPER(xu.user_name) = UPPER(?)
          )
          AND STR_TO_DATE(xxoh.order_date, '%m/%d/%Y') BETWEEN
            COALESCE(?, STR_TO_DATE(xxoh.order_date, '%m/%d/%Y'))
            AND COALESCE(?, STR_TO_DATE(xxoh.order_date, '%m/%d/%Y'))
          AND (
            ? IS NULL
            OR ? = ''
            OR UPPER(
              IFNULL(
                (
                  SELECT first_name
                  FROM xxafmc_non_members
                  WHERE id = xxoh.member_id
                ),
                (
                  SELECT first_name
                  FROM xxafmc_users
                  WHERE user_id = xxoh.user_id
                )
              )
            ) = UPPER(?)
          )
        GROUP BY xxoh.order_num, xxoh.order_total
      ) t
    ) final_data
    ORDER BY ord ASC, order_num DESC
  `;

  const fromDate = normalizeDate(from, false);
  const toDate = normalizeDate(to, true);
  const requestedUser = username?.trim() || null;
  const activeUser = appUser?.trim() || null;

  const params = [
    activeUser,
    activeUser,
    activeUser,
    activeUser,
    fromDate,
    toDate,
    requestedUser,
    requestedUser,
    requestedUser,
    activeUser,
    activeUser,
    activeUser,
    activeUser,
    fromDate,
    toDate,
    requestedUser,
    requestedUser,
    requestedUser,
  ];

  const [rows] = await db.execute(query, params);
  return rows;
}

async function getOrderDetails(orderNumber) {
  const query = `
    SELECT
      od.order_line_id,
      od.order_id AS order_num,
      od.item_id,
      COALESCE(xi.item_name, od.item_id) AS item_name,
      od.quantity,
      xi.type,
      COALESCE(NULLIF(od.order_status, ''), 'Pending') AS status
    FROM xxafmc_order_details od
    LEFT JOIN xxafmc_inventory xi
      ON xi.item_code = od.item_id
    WHERE od.order_id = ?
    ORDER BY od.order_line_id ASC
  `;

  const [rows] = await db.execute(query, [orderNumber]);
  return rows;
}

module.exports = {
  getAdminOrderHistory,
  getOrderDetails,
};
