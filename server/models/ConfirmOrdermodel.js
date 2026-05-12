const db = require("../config/db");

function normalizeKitchenType(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "BAR") {
    return "Bar";
  }
  return "Kitchen";
}

function deriveKitchenTypeFromCategory(categoryName) {
  const normalized = String(categoryName || "").trim().toUpperCase();
  return normalized === "LIQUOR" ? "Bar" : "Kitchen";
}

async function confirmOrder(orderNumber, authUser = {}, payload = {}) {
  const normalizedOrderNumber = Number(orderNumber);
  if (!Number.isFinite(normalizedOrderNumber) || normalizedOrderNumber <= 0) {
    const error = new Error("Valid order number is required");
    error.statusCode = 400;
    throw error;
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [orderHeaderRows] = await connection.execute(
      `
        SELECT order_num, user_id, order_date
        FROM xxafmc_order_header
        WHERE order_num = ?
        LIMIT 1
      `,
      [normalizedOrderNumber]
    );

    if (!orderHeaderRows.length) {
      const error = new Error("Order not found");
      error.statusCode = 404;
      throw error;
    }

    const notificationUserId =
      Number(authUser?.userId) ||
      Number(authUser?.user_id) ||
      Number(orderHeaderRows[0]?.user_id) ||
      null;

    if (!notificationUserId) {
      const error = new Error("Unable to resolve the user for this order");
      error.statusCode = 400;
      throw error;
    }

    const createdBy = authUser?.username || authUser?.user_name || "SYSTEM";
    const requestedKitchenType = payload?.kitchenType
      ? normalizeKitchenType(payload.kitchenType)
      : null;

    const [detailRows] = await connection.execute(
      `
        SELECT
          od.item_id,
          od.quantity,
          od.barcode,
          od.type_id,
          xi.item_name,
          c.category_name
        FROM xxafmc_order_details od
        JOIN xxafmc_inventory xi
          ON od.item_id = xi.item_code
        LEFT JOIN xxafmc_categories c
          ON xi.category_id = c.category_id
        WHERE od.order_id = ?
        ORDER BY od.order_line_id ASC
      `,
      [normalizedOrderNumber]
    );

    if (!detailRows.length) {
      const error = new Error("No order items found");
      error.statusCode = 404;
      throw error;
    }

    let insertedCount = 0;

    for (const item of detailRows) {
      const [existingRows] = await connection.execute(
        `
          SELECT COUNT(*) AS existingCount
          FROM xxafmc_kitchen_notification
          WHERE ordernumber = ?
            AND item_id = ?
            AND status IN ('Received', 'Preparing', 'Completed')
        `,
        [normalizedOrderNumber, item.item_id]
      );

      const existingCount = Number(existingRows[0]?.existingCount || 0);
      if (existingCount > 0) {
        continue;
      }

      const kitchenType =
        requestedKitchenType || deriveKitchenTypeFromCategory(item.category_name);

      await connection.execute(
        `
          INSERT INTO xxafmc_kitchen_notification
            (
              ordernumber,
              user_name,
              item_id,
              item_name,
              quantity,
              type_id,
              created_by,
              creation_date,
              msg_read,
              status,
              barcode,
              kitchen_type
            )
          VALUES
            (?, ?, ?, ?, ?, ?, ?, NOW(), 'N', 'Received', ?, ?)
        `,
        [
          normalizedOrderNumber,
          notificationUserId,
          item.item_id,
          item.item_name,
          Number(item.quantity || 0),
          item.type_id || null,
          createdBy,
          item.barcode || null,
          kitchenType,
        ]
      );

      insertedCount += 1;
    }

    await connection.commit();

    return {
      orderNumber: normalizedOrderNumber,
      insertedCount,
      message:
        insertedCount > 0
          ? "Order confirmed successfully"
          : "Order was already confirmed",
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getConfirmedOrderDetails(orderNumber) {
  const normalizedOrderNumber = Number(orderNumber);
  if (!Number.isFinite(normalizedOrderNumber) || normalizedOrderNumber <= 0) {
    const error = new Error("Valid order number is required");
    error.statusCode = 400;
    throw error;
  }

  const [headerRows] = await db.execute(
    `
      SELECT
        oh.order_num,
        oh.order_date,
        COALESCE(MAX(nm.first_name), MAX(u.first_name), '') AS customer_name,
        COALESCE(MAX(kn.status), 'Received') AS status
      FROM xxafmc_order_header oh
      LEFT JOIN xxafmc_users u
        ON u.user_id = oh.user_id
      LEFT JOIN xxafmc_non_members nm
        ON nm.id = oh.member_id
      LEFT JOIN xxafmc_kitchen_notification kn
        ON kn.ordernumber = oh.order_num
      WHERE oh.order_num = ?
      GROUP BY oh.order_num, oh.order_date
      LIMIT 1
    `,
    [normalizedOrderNumber]
  );

  if (!headerRows.length) {
    const error = new Error("Order not found");
    error.statusCode = 404;
    throw error;
  }

  const [itemRows] = await db.execute(
    `
      SELECT
        od.item_id,
        xi.item_name,
        od.quantity,
        od.price,
        od.subtotal,
        COALESCE(kn.status, 'Received') AS status,
        od.subcategory
      FROM xxafmc_order_details od
      JOIN xxafmc_inventory xi
        ON od.item_id = xi.item_code
      LEFT JOIN xxafmc_kitchen_notification kn
        ON kn.ordernumber = od.order_id
        AND kn.item_id = od.item_id
      WHERE od.order_id = ?
      ORDER BY od.order_line_id ASC
    `,
    [normalizedOrderNumber]
  );

  return {
    header: headerRows[0],
    items: itemRows,
  };
}

module.exports = {
  confirmOrder,
  getConfirmedOrderDetails,
};
