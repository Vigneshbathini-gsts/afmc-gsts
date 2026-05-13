const db = require("../config/db");

const findInvoiceByOrder = async (orderNumber) => {
  const query = `
    SELECT * FROM xxafmc_invoices
    WHERE order_num = ?
  `;

  const [rows] = await db.execute(query, [orderNumber]);
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
  const query = `
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
  `;

  const [result] = await db.execute(query, [
    orderNumber,
    paymentMode,
    paymentReference,
    paymentStatus,
    orderDate,
    amount,
    createdBy,
  ]);

  return result;
};

const updateInvoicePayment = async ({
  orderNumber,
  paymentMode,
  paymentReference,
  paymentStatus,
  createdBy = "SYSTEM",
}) => {
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
        paymentMode,
        paymentReference,
        paymentStatus,
        orderNumber,
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
        [orderNumber]
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
          orderNumber,
          paymentMode,
          paymentReference,
          paymentStatus,
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
      [paymentStatus, orderNumber]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const findInvoiceWithItemsByOrder = async (orderNumber) => {
  const query = `
    SELECT
      inv.order_num AS orderNumber,
      inv.payment_method AS paymentMethod,
      inv.payment_status AS paymentStatus,
      DATE_FORMAT(inv.invoice_date, '%c/%e/%Y') AS invoiceDate,
      inv.amount AS totalAmount,
      inv.payment_reference AS paymentReference,
      od.item_id,
      od.quantity,
      od.price,
      od.subtotal,
      COALESCE(i.item_name, od.item_id) AS item_name
    FROM xxafmc_invoices inv
    LEFT JOIN xxafmc_order_details od
      ON od.order_id = inv.order_num
    LEFT JOIN xxafmc_inventory i
      ON i.item_code = od.item_id
    WHERE inv.order_num = ?
  `;

  const [rows] = await db.execute(query, [orderNumber]);
  return rows;
};

const findOrderWithItemsByOrder = async (orderNumber) => {
  const query = `
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
      oh.order_total AS totalAmount,
      '' AS paymentReference,
      od.item_id,
      od.quantity,
      od.price,
      od.subtotal,
      COALESCE(i.item_name, od.item_id) AS item_name
    FROM xxafmc_order_header oh
    LEFT JOIN xxafmc_order_details od
      ON od.order_id = oh.order_num
    LEFT JOIN xxafmc_inventory i
      ON i.item_code = od.item_id
    WHERE oh.order_num = ?
    ORDER BY od.order_line_id ASC
  `;

  const [rows] = await db.execute(query, [orderNumber]);
  return rows;
};

module.exports = {
  findInvoiceByOrder,
  createInvoice,
  updateInvoicePayment,
  findInvoiceWithItemsByOrder,
  findOrderWithItemsByOrder,
};
