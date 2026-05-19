const db = require("../../config/db");

const createValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

async function getInvoiceReportByOrderNumber(orderNumber) {
  const normalizedOrderNumber = Number(orderNumber);
  if (!Number.isFinite(normalizedOrderNumber) || normalizedOrderNumber <= 0) {
    throw createValidationError("Valid order number is required");
  }

  const [detailRows] = await db.execute(
    `
      SELECT
        od.order_line_id,
        od.order_id,
        od.item_id,
        COALESCE(xi.item_name, od.item_id) AS item_name,
        od.quantity,
        ROUND(IFNULL(od.subtotal, 0), 2) AS subtotal,
        ROUND(IFNULL(od.price, 0), 2) AS price,
        od.created_by,
        od.creation_date,
        od.last_updated_date,
        od.last_updated_by
      FROM xxafmc_order_details od
      LEFT JOIN xxafmc_inventory xi
        ON xi.item_code = od.item_id
      WHERE od.order_id = ?
        AND od.order_status IS NULL
      ORDER BY od.order_line_id ASC
    `,
    [normalizedOrderNumber]
  );

  if (!detailRows.length) {
    const error = new Error("Invoice report data not found");
    error.statusCode = 404;
    throw error;
  }

  const [headerRows] = await db.execute(
    `
      SELECT
        oh.order_num,
        oh.order_date,
        ROUND(IFNULL(oh.order_total, 0), 2) AS order_total,
        inv.invoice_id,
        inv.invoice_date,
        inv.payment_method,
        inv.payment_status,
        ROUND(IFNULL(inv.amount, 0), 2) AS invoice_amount
      FROM xxafmc_order_header oh
      LEFT JOIN xxafmc_invoices inv
        ON inv.order_num = oh.order_num
      WHERE oh.order_num = ?
      LIMIT 1
    `,
    [normalizedOrderNumber]
  );

  const header = headerRows[0] || {};
  const totalAmount = detailRows.reduce(
    (sum, row) => sum + Number(row.subtotal || 0),
    0
  );
  const totalQuantity = detailRows.reduce(
    (sum, row) => sum + Number(row.quantity || 0),
    0
  );

  return {
    header: {
      order_num: header.order_num || normalizedOrderNumber,
      order_date: header.order_date || null,
      invoice_id: header.invoice_id || null,
      invoice_date: header.invoice_date || header.order_date || null,
      payment_method: header.payment_method || null,
      payment_status: header.payment_status || null,
      order_total: Number(header.order_total || totalAmount || 0),
      invoice_amount: Number(header.invoice_amount || totalAmount || 0),
    },
    items: detailRows.map((row) => ({
      ...row,
      quantity: Number(row.quantity || 0),
      subtotal: Number(row.subtotal || 0),
      price: Number(row.price || 0),
    })),
    summary: {
      total_quantity: totalQuantity,
      total_amount: Number(totalAmount.toFixed(2)),
      total_label: "Total",
    },
  };
}

module.exports = {
  getInvoiceReportByOrderNumber,
};
