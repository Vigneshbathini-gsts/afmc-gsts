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

module.exports = {
  findInvoiceByOrder,
  createInvoice,
  updateInvoicePayment,
  findInvoiceWithItemsByOrder,
};
