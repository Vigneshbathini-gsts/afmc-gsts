import api from "./api";

export const Pubmenubuyservice = {
  createOrder: (payload) => api.post("/Pubmenubuy/create", payload),
  getByOrderNumber: (orderNumber) => api.get(`/Pubmenubuy/${orderNumber}`),
  cancelOrder: (orderNumber) => api.delete(`/Pubmenubuy/${orderNumber}`),
  updateLineQuantity: (orderNumber, orderLineId, quantity) =>
    api.put(`/Pubmenubuy/${orderNumber}/line/${orderLineId}/quantity`, { quantity: Number(quantity) }),
};

export default Pubmenubuyservice;
