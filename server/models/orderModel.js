const db = require("../config/db");
const { getStartOfDay, getEndOfDay, parseDate, toISO } = require("../utils/dateUtils");

async function getAdminOrderHistory({
  from = null,
  to = null,
  username = null,
  userId = null,
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
        CASE
          WHEN SUM(CASE WHEN xxkn.status = 'Completed' THEN 1 ELSE 0 END) > 0
          THEN 'Completed'
          ELSE 'Pending'
        END AS status,
        IFNULL(
          CONCAT(
            UCASE(LEFT(MAX(inv.payment_method), 1)),
            LCASE(SUBSTRING(MAX(inv.payment_method), 2))
          ),
          ''
        ) AS payment_method,
        IFNULL(MAX(inv.payment_status), 'Un Paid') AS payment_status1,
        DATE_FORMAT(
          COALESCE(
            STR_TO_DATE(xxoh.order_date, '%m/%d/%Y'),
            DATE(xxoh.order_date)
          ),
          '%c/%e/%Y'
        ) AS order_date,
        1 AS ord,
        ROUND(COALESCE(xxoh.order_total, (
          SELECT SUM(xxod2.subtotal)
          FROM xxafmc_order_details xxod2
          WHERE xxod2.order_id = xxoh.order_num
        ), 0), 2) AS subtotal
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
        OR xxoh.user_id = ?
      )
      AND xxoh.order_date >= ? AND xxoh.order_date <= ?
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
      GROUP BY xxoh.order_num, xxoh.order_date

      UNION ALL

      SELECT
        NULL AS order_num,
        NULL AS first_name,
        NULL AS status,
        NULL AS payment_method,
        'Total' AS payment_status1,
        NULL AS order_date,
        2 AS ord,
        ROUND(IFNULL(SUM(subtotal), 0), 2) AS subtotal
      FROM (
        SELECT xxoh.order_num, COALESCE(xxoh.order_total, (
          SELECT SUM(xxod2.subtotal)
          FROM xxafmc_order_details xxod2
          WHERE xxod2.order_id = xxoh.order_num
        ), 0) AS subtotal
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
            OR xxoh.user_id = ?
          )
          AND xxoh.order_date >= ? AND xxoh.order_date <= ?
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
      HAVING COUNT(*) > 0
    ) final_data
    ORDER BY ord DESC, order_num DESC
  `;

  const fromDate = from ? getStartOfDay(from) : null;
  const toDate = to ? getEndOfDay(to) : null;
  const requestedUser = username?.trim() || null;
  const activeUserId = userId || null;

  const params = [
    activeUserId,
    activeUserId,
    fromDate,
    toDate,
    requestedUser,
    requestedUser,
    requestedUser,
    activeUserId,
    activeUserId,
    fromDate,
    toDate,
    requestedUser,
    requestedUser,
    requestedUser,
  ];

  const [rows] = await db.execute(query, params);
  console.log("Admin Order History Params:", params);
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

  COALESCE(MAX(nm.first_name), MAX(customer.first_name), '') AS first_name,
  COALESCE(MAX(nm.phone_number), MAX(customer.phone_number), '') AS phone_number,

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

async function getOrderDetails(orderNumber) {
  const query = `
  SELECT
  od.order_line_id,
  od.order_id AS order_num,
  od.item_id,
  COALESCE(xi.item_name, od.item_id) AS item_name,
  od.quantity,
  ROUND(COALESCE(od.price, od.subtotal / NULLIF(od.quantity, 0), 0), 2) AS price,
  ROUND(IFNULL(od.subtotal, 0), 2) AS subtotal,
  COALESCE(NULLIF(xi.type, ''), NULLIF(od.type, ''), 'NA') AS type,
  COALESCE(
    NULLIF(od.order_status, ''),
    (
      SELECT 
        CASE 
          WHEN kn.status = 'Completed' THEN 'Completed'
          WHEN kn.status = 'Preparing' THEN 'Preparing'
          ELSE 'Received'
        END
      FROM xxafmc_kitchen_notification kn
      WHERE kn.ordernumber = od.order_id
        AND TRIM(CAST(kn.item_id AS CHAR)) = TRIM(CAST(od.item_id AS CHAR))
      LIMIT 1
    ),
    'Received'
  ) AS status,
  od.barcode AS barcode,
  od.FREE_ITEM_CODE AS free_item_code,
  od.FREE_ITEM_QUANTITY AS free_item_quantity
FROM xxafmc_order_details od
LEFT JOIN (
    SELECT 
      item_code,
      MAX(item_name) AS item_name,
      MAX(type) AS type
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

async function getOrderSummary(orderNumber) {
  const query = `
    SELECT
      xxoh.order_num,
      ROUND(
        CASE 
          WHEN COALESCE(xxoh.order_total, 0) > 0 THEN xxoh.order_total
          ELSE COALESCE((
            SELECT SUM(COALESCE(od.subtotal, 0))
            FROM xxafmc_order_details od
            WHERE od.order_id = xxoh.order_num
          ), 0)
        END,
        2
      ) AS totalAmount,
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
        ROUND(xxoh.order_total, 2) AS subtotal,
        CASE 
          WHEN MAX(CASE WHEN xxkn.status = 'Completed' THEN 1 END) = 1 
          THEN 'Completed'
          WHEN MAX(CASE WHEN xxkn.status = 'Cancelled' THEN 1 END) = 1
          THEN 'Cancelled'
        END AS status,
        DATE_FORMAT(MAX(xxod.creation_date), '%Y-%m-%d %H:%i:%s') AS creation_date,
        MAX(
          IFNULL(
            (SELECT xnm.first_name FROM xxafmc_non_members xnm WHERE xnm.id = xxoh.member_id), 
            (SELECT xu2.first_name FROM xxafmc_users xu2 WHERE xu2.user_id = xxoh.user_id)
          )
        ) AS first_name,
        CASE 
  WHEN MAX(xxod.payment_status) = 'Paid' 
  THEN 1
  ELSE 0
END AS is_paid,
        CASE  
          WHEN MAX(xxod.payment_status) IS NULL THEN 'Un Paid'
          ELSE MAX(xxod.payment_status)
        END AS payment_status1
      FROM xxafmc_order_header xxoh
      JOIN xxafmc_order_details xxod ON xxoh.order_num = xxod.order_id
      JOIN xxafmc_inventory xxui ON xxod.item_id = xxui.item_code
      JOIN xxafmc_kitchen_notification xxkn ON xxod.order_id = xxkn.ordernumber
      JOIN xxafmc_users xu ON xxkn.user_name = xu.user_id
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
        xxoh.order_num,
        xu.first_name,
        xxoh.order_total
      ORDER BY 
        MAX(xxod.creation_date) DESC
    `;

  const cleanUser = appUser?.trim() || null;
  const params = [cleanUser, fromDate || null, toDate || null];
  const [rows] = await db.execute(query, params);
//  console.log("User Order History Params:", rows);
  return rows;
}


module.exports = {
  getActiveOrders,
  getAdminOrderHistory,
  getNonMemberByPhone,
  getUserOrderHistory,
  getOrderDetails,
  getOrderSummary,
  saveNonMember,
};
