import { invoiceReportAPI } from "./api";

const InvoiceReportservice = {
  getByOrderNumber: (orderNumber) => invoiceReportAPI.getByOrderNumber(orderNumber),
};

export default InvoiceReportservice;
