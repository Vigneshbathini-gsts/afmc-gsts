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

async function getActiveOrders({
  from = null,
  to = null,
  search = null,
  appUser = null,
}) {
  const query = `
    SELECT
      xoh.order_num,
      ROUND(xoh.order_total, 2) AS order_total,
      xoh.creation_date,
      DATE_FORMAT(
        COALESCE(
          STR_TO_DATE(xoh.order_date, '%m/%d/%Y'),
          xoh.creation_date
        ),
        '%c/%e/%Y'
      ) AS order_date,
      CASE
        WHEN COUNT(CASE WHEN xkn.status = 'Cancelled' THEN 1 END) = COUNT(xkn.status)
          THEN 'Cancelled'
        WHEN COUNT(CASE WHEN xkn.status = 'Completed' THEN 1 END) = COUNT(xkn.status)
          THEN 'Completed'
        WHEN COUNT(CASE WHEN xkn.status = 'Received' THEN 1 END) > 0
          THEN 'Received'
        WHEN COUNT(CASE WHEN xkn.status = 'Preparing' THEN 1 END) > 0
          THEN 'Preparing'
        ELSE 'Received'
      END AS status,
      MAX(
        IFNULL(
          (
            SELECT xnm.first_name
            FROM xxafmc_non_members xnm
            WHERE xnm.id = xoh.member_id
            LIMIT 1
          ),
          (
            SELECT xu2.first_name
            FROM xxafmc_users xu2
            WHERE xu2.user_id = xoh.user_id
            LIMIT 1
          )
        )
      ) AS first_name,
      MAX(
        (
          SELECT xnm.phone_number
          FROM xxafmc_non_members xnm
          WHERE xnm.id = xoh.member_id
          LIMIT 1
        )
      ) AS phone_number,
      CASE
        WHEN MAX(xkn.status) IN ('Received', 'Preparing') THEN NULL
        ELSE MAX(xod.payment_status)
      END AS payment_status
    FROM xxafmc_order_header xoh
    JOIN xxafmc_kitchen_notification xkn
      ON xoh.order_num = xkn.ordernumber
    JOIN xxafmc_order_details xod
      ON xkn.ordernumber = xod.order_id
     AND xkn.item_id = xod.item_id
    JOIN xxafmc_users xu
      ON xoh.user_id = xu.user_id
    WHERE IFNULL(xod.payment_status, '') = ''
      AND xkn.status IN ('Received', 'Preparing', 'Cancelled', 'Completed')
      AND (
        ? IS NULL
        OR ? = ''
        OR UPPER(xu.user_name) = UPPER(?)
      )
      AND COALESCE(
        STR_TO_DATE(xoh.order_date, '%m/%d/%Y'),
        DATE(xoh.creation_date)
      ) BETWEEN
        COALESCE(?, COALESCE(STR_TO_DATE(xoh.order_date, '%m/%d/%Y'), DATE(xoh.creation_date)))
        AND COALESCE(?, COALESCE(STR_TO_DATE(xoh.order_date, '%m/%d/%Y'), DATE(xoh.creation_date)))
      AND (
        ? IS NULL
        OR ? = ''
        OR CAST(xoh.order_num AS CHAR) LIKE CONCAT('%', ?, '%')
        OR UPPER(
          IFNULL(
            (
              SELECT xnm.first_name
              FROM xxafmc_non_members xnm
              WHERE xnm.id = xoh.member_id
              LIMIT 1
            ),
            (
              SELECT xu3.first_name
              FROM xxafmc_users xu3
              WHERE xu3.user_id = xoh.user_id
              LIMIT 1
            )
          )
        ) LIKE CONCAT('%', UPPER(?), '%')
      )
    GROUP BY xoh.order_num, xoh.order_total, xoh.creation_date, xoh.order_date
    HAVING (
      COUNT(CASE WHEN xkn.status = 'Cancelled' THEN 1 END) = COUNT(xkn.status)
      OR COUNT(CASE WHEN xkn.status = 'Received' THEN 1 END) > 0
      OR COUNT(CASE WHEN xkn.status = 'Preparing' THEN 1 END) > 0
    )
    ORDER BY xoh.order_num DESC
  `;

  const fromDate = from || null;
  const toDate = to || null;
  const safeSearch = search?.trim() || null;
  const safeUser = appUser?.trim() || null;

  const [rows] = await db.execute(query, [
    safeUser,
    safeUser,
    safeUser,
    fromDate,
    toDate,
    safeSearch,
    safeSearch,
    safeSearch,
    safeSearch,
  ]);

  return rows;
}

async function getOrderDetails(orderNumber) {
  const query = `
    SELECT
      xkn.item_name,
      xkn.status,
      xod.quantity,
      IFNULL(NULLIF(xod.type, ''), 'NA') AS type
    FROM xxafmc_order_details xod
    JOIN xxafmc_kitchen_notification xkn
      ON xod.order_id = xkn.ordernumber
     AND xod.item_id = xkn.item_id
    WHERE xkn.ordernumber = ?
    ORDER BY xkn.item_name ASC
  `;

  const [rows] = await db.execute(query, [orderNumber]);
  return rows;
}

async function getNonMemberByPhone(phoneNumber) {
  const safePhone = String(phoneNumber ?? "").trim();
  if (!safePhone) {
    return null;
  }

  const [rows] = await db.execute(
    `
      SELECT
        ID AS id,
        FIRST_NAME AS first_name,
        LAST_NAME AS last_name,
        PHONE_NUMBER AS phone_number
      FROM xxafmc_non_members
      WHERE TRIM(PHONE_NUMBER) = ?
      LIMIT 1
    `,
    [safePhone]
  );

  return rows[0] || null;
}

async function saveNonMember({ firstName, lastName, phoneNumber, createdBy }) {
  const safePhone = String(phoneNumber ?? "").trim();
  const safeFirstName = String(firstName ?? "").trim();
  const safeLastName = String(lastName ?? "").trim();
  const today = new Date().toISOString().slice(0, 10);

  if (!safePhone || !safeFirstName) {
    const error = new Error("INVALID_DATA");
    error.code = "INVALID_DATA";
    throw error;
  }

  const existing = await getNonMemberByPhone(safePhone);
  if (existing) {
    return {
      id: existing.id,
      first_name: existing.first_name || safeFirstName,
      last_name: existing.last_name || safeLastName,
      phone_number: safePhone,
      existed: true,
    };
  }

  const safeCreatedBy = String(createdBy ?? "").trim() || "SYSTEM";
  const [nextIdRows] = await db.execute(
    "SELECT IFNULL(MAX(ID), 0) + 1 AS next_id FROM xxafmc_non_members"
  );
  const nextId = Number(nextIdRows[0]?.next_id || 1);

  await db.execute(
    `
      INSERT INTO xxafmc_non_members
        (ID, FIRST_NAME, LAST_NAME, PHONE_NUMBER, CREATED_BY, CREATION_DATE)
      VALUES
        (?, ?, ?, ?, ?, ?)
    `,
    [nextId, safeFirstName, safeLastName, safePhone, safeCreatedBy, today]
  );

  return {
    id: nextId,
    first_name: safeFirstName,
    last_name: safeLastName,
    phone_number: safePhone,
    existed: false,
  };
}

module.exports = {
  getActiveOrders,
  getAdminOrderHistory,
  getOrderDetails,
  getNonMemberByPhone,
  saveNonMember,
};
