import api from "./api";

export const ConfirmOrderservice = {
  confirmOrder: (orderNumber, payload = {}) =>
    api.post(`/confirmed-orders/${orderNumber}`, payload),
  getConfirmedOrder: (orderNumber) => api.get(`/confirmed-orders/${orderNumber}`),
};

export default ConfirmOrderservice;
