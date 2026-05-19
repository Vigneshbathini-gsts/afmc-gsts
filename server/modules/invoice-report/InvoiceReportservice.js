const invoiceReportModel = require("./InvoiceReportmodel");

const getInvoiceReportByOrderNumber = async (orderNumber) =>
  invoiceReportModel.getInvoiceReportByOrderNumber(orderNumber);

module.exports = {
  getInvoiceReportByOrderNumber,
};
