const invoiceModel = require("./invoiceModel");

const createInvoice = async (invoiceData) => {
  const existingInvoice =
    await invoiceModel.findInvoiceByOrder(
      invoiceData.orderNumber
    );

  if (existingInvoice) {
    throw new Error("Invoice already exists");
  }

  return await invoiceModel.createInvoice(invoiceData);
};

const fetchInvoiceByOrder = async (orderNumber) => {
  let rows = await invoiceModel.findInvoiceWithItemsByOrder(orderNumber);

  if (!rows || rows.length === 0) {
    // APEX "invoice report" page reads directly from order_details even before an invoice row exists.
    // Provide the same behavior by falling back to order header/details.
    rows = await invoiceModel.findOrderWithItemsByOrder(orderNumber);
    if (!rows || rows.length === 0) {
      return null;
    }
  }

  const invoiceRow = rows[0];

  return {
    orderNumber: invoiceRow.orderNumber,
    paymentMethod: invoiceRow.paymentMethod || "",
    paymentStatus: invoiceRow.paymentStatus || "",
    invoiceDate: invoiceRow.invoiceDate || "",
    totalAmount: invoiceRow.totalAmount || 0,
    paymentReference: invoiceRow.paymentReference || "",
    items: rows.map((row) => ({
      ITEM_NAME: row.item_name || row.item_id || "",
      QUANTITY: row.quantity,
      PRICE: row.price,
      SUBTOTAL: row.subtotal,
    })),
  };
};

module.exports = {
  createInvoice,
  fetchInvoiceByOrder,
  saveInvoicePayment: async ({ orderNumber, paymentMode, paymentReference, paymentStatus, createdBy }) => {
    await invoiceModel.updateInvoicePayment({
      orderNumber,
      paymentMode,
      paymentReference,
      paymentStatus,
      createdBy,
    });

    return { orderNumber, paymentStatus };
  },
};
