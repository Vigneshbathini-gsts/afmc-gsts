const db = require("../config/db");

const normalizeDate = (value) => {
  if (!value) {
    return null;
  }

  const trimmed = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
    const [month, day, year] = trimmed.split("/");
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(trimmed);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
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
    ORDER BY ord DESC, order_num DESC
  `;

  const fromDate = normalizeDate(from);
  const toDate = normalizeDate(to);
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
  userId = null,
}) {
  const query = `
    SELECT
      oh.order_num,
      DATE_FORMAT(STR_TO_DATE(oh.order_date, '%m/%d/%Y'), '%c/%e/%Y') AS order_date,
      STR_TO_DATE(oh.order_date, '%m/%d/%Y') AS creation_date,
      COALESCE(MAX(nm.first_name), MAX(customer.first_name), '') AS first_name,
      COALESCE(MAX(nm.phone_number), MAX(customer.phone_number), '') AS phone_number,
      ROUND(MAX(oh.order_total), 2) AS order_total,
      CASE
        WHEN SUM(CASE WHEN UPPER(IFNULL(od.order_status, '')) = 'CANCELLED' THEN 1 ELSE 0 END) = COUNT(DISTINCT od.order_line_id)
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
    WHERE STR_TO_DATE(oh.order_date, '%m/%d/%Y') BETWEEN
      COALESCE(?, STR_TO_DATE(oh.order_date, '%m/%d/%Y'))
      AND COALESCE(?, STR_TO_DATE(oh.order_date, '%m/%d/%Y'))
      AND (
        ? IS NULL
        OR ? = ''
        OR UPPER(attendant.user_name) = UPPER(?)
      )
      AND (
        ? IS NULL
        OR oh.user_id = ?
      )
      AND (
        ? IS NULL
        OR ? = ''
        OR CAST(oh.order_num AS CHAR) LIKE ?
        OR UPPER(COALESCE(nm.first_name, customer.first_name, '')) LIKE UPPER(?)
        OR COALESCE(nm.phone_number, customer.phone_number, '') LIKE ?
      )
    GROUP BY oh.order_num, oh.order_date
    HAVING status IN ('Received', 'Preparing', 'Pending')
    ORDER BY creation_date DESC, oh.order_num DESC
  `;

  const fromDate = normalizeDate(from);
  const toDate = normalizeDate(to);
  const searchTerm = search?.trim() || null;
  const searchLike = searchTerm ? `%${searchTerm}%` : null;
  const normalizedAppUser = appUser?.trim() || null;
  const normalizedUserId = userId || null;

  const [rows] = await db.execute(query, [
    fromDate,
    toDate,
    normalizedAppUser,
    normalizedAppUser,
    normalizedAppUser,
    normalizedUserId,
    normalizedUserId,
    searchTerm,
    searchTerm,
    searchLike,
    searchLike,
    searchLike,
  ]);

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
  COALESCE(NULLIF(xi.type, ''), 'NA') AS type,
  COALESCE(NULLIF(od.order_status, ''), 'Pending') AS status
FROM xxafmc_order_details od
LEFT JOIN (
    SELECT 
      item_code,
      MAX(item_name) AS item_name,
      MAX(COALESCE(NULLIF(type, ''), 'NA')) AS type
    FROM xxafmc_inventory
    GROUP BY item_code
) xi
  ON xi.item_code = od.item_id
WHERE od.order_id = ?
ORDER BY od.order_line_id ASC;
  `;

  const [rows] = await db.execute(query, [orderNumber]);
  return rows;
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

module.exports = {
  getActiveOrders,
  getAdminOrderHistory,
  getNonMemberByPhone,
  getOrderDetails,
  saveNonMember,
};
