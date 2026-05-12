const invoiceReportModel = require("../models/InvoiceReportmodel");

const getInvoiceReportByOrderNumber = async (orderNumber) =>
  invoiceReportModel.getInvoiceReportByOrderNumber(orderNumber);

module.exports = {
  getInvoiceReportByOrderNumber,
};
