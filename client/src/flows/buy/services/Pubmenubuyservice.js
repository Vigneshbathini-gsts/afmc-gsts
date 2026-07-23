import api from "../../../services/api";

export const Pubmenubuyservice = {
  createOrder: (payload) => api.post("/buy-orders", payload),
  getByOrderNumber: (orderNumber) => api.get(`/buy-orders/${orderNumber}`),
  updateItemQuantity: (orderNumber, itemCode, delta) =>
    api.patch(`/buy-orders/${orderNumber}/items/${itemCode}`, { delta }),
  updateItemCustomization: (orderNumber, itemCode, ingredients) =>
    api.put(`/buy-orders/${orderNumber}/items/${itemCode}/customization`, { ingredients }),
  deleteItem: (orderNumber, itemCode) =>
    api.delete(`/buy-orders/${orderNumber}/items/${itemCode}`),
  cancelOrder: (orderNumber) => api.delete(`/buy-orders/${orderNumber}`),
  updateLineQuantity: (orderNumber, orderLineId, quantity) =>
    api.put(`/buy-orders/${orderNumber}/lines/${orderLineId}/quantity`, { quantity: Number(quantity) }),
};

export default Pubmenubuyservice;
