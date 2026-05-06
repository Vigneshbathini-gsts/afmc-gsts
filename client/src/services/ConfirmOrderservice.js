import api from "./api";

export const ConfirmOrderservice = {
  confirmOrder: (orderNumber, payload = {}) =>
    api.post(`/confirm-order/${orderNumber}`, payload),
  getConfirmedOrder: (orderNumber) => api.get(`/confirm-order/${orderNumber}`),
};

export default ConfirmOrderservice;
