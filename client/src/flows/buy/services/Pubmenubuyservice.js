import api from "../../../services/api";

export const Pubmenubuyservice = {
  createOrder: (payload) => api.post("/Pubmenubuy/create", payload),
  getByOrderNumber: (orderNumber) => api.get(`/Pubmenubuy/${orderNumber}`),
  updateItemQuantity: (orderNumber, itemCode, delta) =>
    api.patch(`/Pubmenubuy/${orderNumber}/item/${itemCode}`, { delta }),
  updateItemCustomization: (orderNumber, itemCode, ingredients) =>
    api.put(`/Pubmenubuy/${orderNumber}/item/${itemCode}/customization`, { ingredients }),
  deleteItem: (orderNumber, itemCode, orderLineId) =>
    api.delete(`/Pubmenubuy/${orderNumber}/item/${itemCode}`, {
      params: orderLineId ? { orderLineId } : undefined,
    }),
  cancelOrder: (orderNumber) => api.delete(`/Pubmenubuy/${orderNumber}`),
  updateLineQuantity: (orderNumber, orderLineId, quantity) =>
    api.put(`/Pubmenubuy/${orderNumber}/line/${orderLineId}/quantity`, { quantity: Number(quantity) }),
};

export default Pubmenubuyservice;
