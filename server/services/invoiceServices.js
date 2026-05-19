const invoiceModel = require("../modules/invoice/invoiceModel");

const getInvoiceDetails = async (orderNumber) =>
  invoiceModel.getInvoiceDetails(orderNumber);

const saveInvoicePayment = async (orderNumber, payload, authUser) =>
  invoiceModel.saveInvoicePayment(orderNumber, payload, authUser);

module.exports = {
  getInvoiceDetails,
  saveInvoicePayment,
};
