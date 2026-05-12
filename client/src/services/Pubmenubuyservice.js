import api from "./api";

export const Pubmenubuyservice = {
  createOrder: (payload) => api.post("/Pubmenubuy/create", payload),
  getByOrderNumber: (orderNumber) => api.get(`/Pubmenubuy/${orderNumber}`),
  updateItemQuantity: (orderNumber, itemCode, delta) =>
    api.patch(`/Pubmenubuy/${orderNumber}/item/${itemCode}`, { delta }),
  deleteItem: (orderNumber, itemCode) => api.delete(`/Pubmenubuy/${orderNumber}/item/${itemCode}`),
  cancelOrder: (orderNumber) => api.delete(`/Pubmenubuy/${orderNumber}`),
};

export default Pubmenubuyservice;
