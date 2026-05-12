import { invoiceAPI } from "./api";

const Invoiceservice = {
  getByOrderNumber: (orderNumber) => invoiceAPI.getByOrderNumber(orderNumber),
  savePayment: (orderNumber, data) => invoiceAPI.savePayment(orderNumber, data),
};

export default Invoiceservice;
