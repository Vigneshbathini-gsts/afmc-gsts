const db = require("../config/db");

const createValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

async function getInvoiceDetails(orderNumber) {
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
        ROUND(IFNULL(oh.order_total, 0), 2) AS order_total,
        od.item_id,
        inv.invoice_id,
        inv.payment_method,
        inv.payment_reference,
        inv.payment_status,
        inv.invoice_date,
        ROUND(IFNULL(inv.amount, 0), 2) AS amount
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
        ROUND(IFNULL(od.price, 0), 2) AS price,
        ROUND(IFNULL(od.subtotal, 0), 2) AS total
      FROM xxafmc_order_details od
      LEFT JOIN xxafmc_inventory xi
        ON xi.item_code = od.item_id
      WHERE od.order_id = ?
        AND od.order_status IS NULL
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

async function saveInvoicePayment(orderNumber, payload = {}, authUser = {}) {
  const normalizedOrderNumber = Number(orderNumber);
  if (!Number.isFinite(normalizedOrderNumber) || normalizedOrderNumber <= 0) {
    throw createValidationError("Valid order number is required");
  }

  const paymentMode = String(payload.paymentMode || "").trim();
  const paymentReference = String(payload.paymentReference || "").trim();
  const normalizedPaymentMode = paymentMode ? paymentMode.toUpperCase() : "";

  if (!paymentMode) {
    throw createValidationError("Payment mode is required");
  }

  if (normalizedPaymentMode === "IMMEDIATE" && !paymentReference) {
    throw createValidationError("Payment reference is required for immediate payment");
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [[orderHeader]] = await connection.execute(
      `
        SELECT order_num, order_date, ROUND(IFNULL(order_total, 0), 2) AS order_total
        FROM xxafmc_order_header
        WHERE order_num = ?
        LIMIT 1
      `,
      [normalizedOrderNumber]
    );

    if (!orderHeader) {
      const error = new Error("Invoice order not found");
      error.statusCode = 404;
      throw error;
    }

    const [[invoiceRow]] = await connection.execute(
      `
        SELECT invoice_id
        FROM xxafmc_invoices
        WHERE order_num = ?
        LIMIT 1
      `,
      [normalizedOrderNumber]
    );

    const appUser = authUser?.username || authUser?.user_name || "SYSTEM";
    const resolvedStatus = normalizedPaymentMode === "CREDIT" ? "Un Paid" : "Paid";

    if (!invoiceRow) {
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
          paymentMode,
          paymentReference || null,
          resolvedStatus,
          orderHeader.order_date,
          Number(orderHeader.order_total || 0),
          appUser,
        ]
      );
    } else {
      await connection.execute(
        `
          UPDATE xxafmc_invoices
          SET payment_status = ?,
              payment_method = ?,
              payment_reference = ?
          WHERE order_num = ?
        `,
        [resolvedStatus, paymentMode, paymentReference || null, normalizedOrderNumber]
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
    return getInvoiceDetails(normalizedOrderNumber);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  getInvoiceDetails,
  saveInvoicePayment,
};
