const db = require("../../config/db");

const createValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

async function getInvoiceDetails(orderNumber) {
  console.log("Fetching invoice details for order number:", orderNumber);
  const normalizedOrderNumber = Number(orderNumber);
  if (!Number.isFinite(normalizedOrderNumber) || normalizedOrderNumber <= 0) {
    throw createValidationError("Valid order number is required");
  }

  const [headerRows] = await db.execute(
    `
      SELECT
        oh.order_num,
        oh.user_id,
        oh.order_date,
        ROUND(IFNULL((
          SELECT SUM(
            CASE
              WHEN TRIM(UPPER(IFNULL(od2.order_status, ''))) = 'CANCELLED' THEN 0
              ELSE IFNULL(od2.subtotal, 0)
            END
          )
          FROM xxafmc_order_details od2
          WHERE od2.order_id = oh.order_num
        ), 0), 2) AS order_total,
        od.item_id,
        inv.invoice_id,
        inv.payment_method,
        inv.payment_reference,
        inv.payment_status,
        inv.invoice_date,
        ROUND( IFNULL(
          inv.amount,
          (
            SELECT SUM(
              CASE
                WHEN TRIM(UPPER(IFNULL(od2.order_status, ''))) = 'CANCELLED' THEN 0
                ELSE IFNULL(od2.subtotal, 0)
              END
            )
            FROM xxafmc_order_details od2
            WHERE od2.order_id = oh.order_num
          )
        ), 2) AS amount
      FROM xxafmc_order_header oh
      LEFT JOIN xxafmc_order_details od
        ON od.order_id = oh.order_num
      LEFT JOIN xxafmc_invoices inv
        ON inv.order_num = oh.order_num
      WHERE oh.order_num = ?
      ORDER BY od.order_line_id ASC
      LIMIT 1
    `,
    [normalizedOrderNumber]
  );

  if (!headerRows.length) {
    const error = new Error("Invoice order not found");
    error.statusCode = 404;
    throw error;
  }

  const [itemRows] = await db.execute(
    `
      SELECT
        od.item_id,
        COALESCE(xi.item_name, od.item_id) AS item_name,
        od.quantity,
        od.order_status,
        ROUND(
          CASE
            WHEN TRIM(UPPER(IFNULL(od.order_status, ''))) = 'CANCELLED' THEN 0
            ELSE IFNULL(od.price, 0)
          END,
          2
        ) AS price,
        ROUND(
          CASE
            WHEN TRIM(UPPER(IFNULL(od.order_status, ''))) = 'CANCELLED' THEN 0
            ELSE IFNULL(od.subtotal, 0)
          END,
          2
        ) AS total
      FROM xxafmc_order_details od
      LEFT JOIN xxafmc_inventory xi
        ON xi.item_code = od.item_id
      WHERE od.order_id = ?
        AND TRIM(UPPER(IFNULL(od.order_status, ''))) <> 'CANCELLED'
      ORDER BY od.order_line_id ASC
    `,
    [normalizedOrderNumber]
  );

  const header = headerRows[0];

  return {
    header: {
      order_num: header.order_num,
      user_id: header.user_id,
      order_date: header.order_date,
      order_total: header.order_total,
      item_id: header.item_id || null,
    },
    invoice: {
      invoice_id: header.invoice_id || null,
      payment_method: header.payment_method || "Credit",
      payment_reference: header.payment_reference || "",
      payment_status: header.payment_status || "Un Paid",
      invoice_date: header.invoice_date || header.order_date,
      amount: Number(header.amount || header.order_total || 0),
    },
    items: itemRows,
  };
}

const findInvoiceByOrder = async (orderNumber) => {
  const [rows] = await db.execute(
    `
      SELECT *
      FROM xxafmc_invoices
      WHERE order_num = ?
    `,
    [orderNumber]
  );
  return rows[0] || null;
};

const createInvoice = async ({
  orderNumber,
  paymentMode,
  paymentReference,
  paymentStatus,
  orderDate,
  amount,
  createdBy,
}) => {
  const [result] = await db.execute(
    `
      INSERT INTO xxafmc_invoices (
        order_num,
        payment_method,
        payment_reference,
        payment_status,
        invoice_date,
        amount,
        creation_by,
        creation_date
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `,
    [
      orderNumber,
      paymentMode,
      paymentReference,
      paymentStatus,
      orderDate,
      amount,
      createdBy,
    ]
  );

  return result;
};

const updateInvoicePayment = async ({
  orderNumber,
  paymentMode,
  paymentReference,
  paymentStatus,
  createdBy = "SYSTEM",
}) => {
  const normalizedOrderNumber = Number(orderNumber);
  if (!Number.isFinite(normalizedOrderNumber) || normalizedOrderNumber <= 0) {
    throw createValidationError("Valid order number is required");
  }

  const normalizedPaymentMode = String(paymentMode || "").trim();
  if (!normalizedPaymentMode) {
    throw createValidationError("Payment mode is required");
  }

  if (normalizedPaymentMode.toUpperCase() === "IMMEDIATE" && !String(paymentReference || "").trim()) {
    throw createValidationError("Payment reference is required for immediate payment");
  }

  const resolvedStatus =
    paymentStatus || (normalizedPaymentMode.toUpperCase() === "CREDIT" ? "Un Paid" : "Paid");

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [updateResult] = await connection.execute(
      `
        UPDATE xxafmc_invoices
        SET payment_method = ?,
            payment_reference = ?,
            payment_status = ?
        WHERE order_num = ?
      `,
      [
        normalizedPaymentMode,
        paymentReference || null,
        resolvedStatus,
        normalizedOrderNumber,
      ]
    );

    if (updateResult.affectedRows === 0) {
      const [orderRows] = await connection.execute(
        `
          SELECT
            order_num,
            order_total,
            COALESCE(
              STR_TO_DATE(order_date, '%m/%d/%Y'),
              DATE(order_date),
              CURDATE()
            ) AS invoice_date
          FROM xxafmc_order_header
          WHERE order_num = ?
          LIMIT 1
        `,
        [normalizedOrderNumber]
      );

      if (!orderRows.length) {
        const error = new Error("Order not found for invoice creation");
        error.statusCode = 404;
        throw error;
      }

      await connection.execute(
        `
          INSERT INTO xxafmc_invoices (
            order_num,
            payment_method,
            payment_reference,
            payment_status,
            invoice_date,
            amount,
            creation_by,
            creation_date
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        `,
        [
          normalizedOrderNumber,
          normalizedPaymentMode,
          paymentReference || null,
          resolvedStatus,
          orderRows[0].invoice_date,
          orderRows[0].order_total || 0,
          createdBy,
        ]
      );
    }

    await connection.execute(
      `
        UPDATE xxafmc_order_details
        SET payment_status = ?
        WHERE order_id = ?
      `,
      [resolvedStatus, normalizedOrderNumber]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

async function saveInvoicePayment(orderNumber, payload = {}, authUser = {}) {
  await updateInvoicePayment({
    orderNumber,
    paymentMode: payload.paymentMode,
    paymentReference: payload.paymentReference,
    paymentStatus: payload.paymentStatus,
    createdBy: authUser?.username || authUser?.user_name || "SYSTEM",
  });

  return getInvoiceDetails(orderNumber);
}

const findInvoiceWithItemsByOrder = async (orderNumber) => {
  const [rows] = await db.execute(
    `
      SELECT
        inv.order_num AS orderNumber,
        inv.payment_method AS paymentMethod,
        inv.payment_status AS paymentStatus,
        DATE_FORMAT(inv.invoice_date, '%c/%e/%Y') AS invoiceDate,
        ROUND(
          COALESCE(
            (
              SELECT SUM(
                CASE
                  WHEN TRIM(UPPER(IFNULL(xxod.order_status, ''))) = 'CANCELLED' THEN 0
                  ELSE IFNULL(xxod.subtotal, 0)
                END
              )
              FROM xxafmc_order_details xxod
              WHERE xxod.order_id = inv.order_num
            ),
            0
          ),
          2
        ) AS totalAmount,
        inv.payment_reference AS paymentReference,
        od.item_id,
        od.quantity,
        od.order_status AS order_status,
        ROUND(
          CASE
            WHEN TRIM(UPPER(IFNULL(od.order_status, ''))) = 'CANCELLED' THEN 0
            ELSE IFNULL(od.price, 0)
          END,
          2
        ) AS price,
        ROUND(
          CASE
            WHEN TRIM(UPPER(IFNULL(od.order_status, ''))) = 'CANCELLED' THEN 0
            ELSE IFNULL(od.subtotal, 0)
          END,
          2
        ) AS subtotal,
        COALESCE(i.item_name, od.item_id) AS item_name
      FROM xxafmc_invoices inv
      LEFT JOIN xxafmc_order_details od
        ON od.order_id = inv.order_num
      LEFT JOIN xxafmc_inventory i
        ON i.item_code = od.item_id
      WHERE inv.order_num = ?
      ORDER BY od.order_line_id ASC
    `,
    [orderNumber]
  );
  return rows;
};

const findOrderWithItemsByOrder = async (orderNumber) => {
  const [rows] = await db.execute(
    `
      SELECT
        oh.order_num AS orderNumber,
        '' AS paymentMethod,
        '' AS paymentStatus,
        DATE_FORMAT(
          COALESCE(
            STR_TO_DATE(oh.order_date, '%m/%d/%Y'),
            DATE(oh.order_date),
            CURDATE()
          ),
          '%c/%e/%Y'
        ) AS invoiceDate,
        ROUND(
          COALESCE(
            (
              SELECT SUM(
                CASE
                  WHEN TRIM(UPPER(IFNULL(od2.order_status, ''))) = 'CANCELLED' THEN 0
                  ELSE IFNULL(od2.subtotal, 0)
                END
              )
              FROM xxafmc_order_details od2
              WHERE od2.order_id = oh.order_num
            ),
            0
          ),
          2
        ) AS totalAmount,
        '' AS paymentReference,
        od.item_id,
        od.quantity,
        od.order_status AS order_status,
        ROUND(
          CASE
            WHEN TRIM(UPPER(IFNULL(od.order_status, ''))) = 'CANCELLED' THEN 0
            ELSE IFNULL(od.price, 0)
          END,
          2
        ) AS price,
        ROUND(
          CASE
            WHEN TRIM(UPPER(IFNULL(od.order_status, ''))) = 'CANCELLED' THEN 0
            ELSE IFNULL(od.subtotal, 0)
          END,
          2
        ) AS subtotal,
        COALESCE(i.item_name, od.item_id) AS item_name
      FROM xxafmc_order_header oh
      LEFT JOIN xxafmc_order_details od
        ON od.order_id = oh.order_num
      LEFT JOIN xxafmc_inventory i
        ON i.item_code = od.item_id
      WHERE oh.order_num = ?
      ORDER BY od.order_line_id ASC
    `,
    [orderNumber]
  );
  return rows;
};

module.exports = {
  getInvoiceDetails,
  saveInvoicePayment,
  findInvoiceByOrder,
  createInvoice,
  updateInvoicePayment,
  findInvoiceWithItemsByOrder,
  findOrderWithItemsByOrder,
};
