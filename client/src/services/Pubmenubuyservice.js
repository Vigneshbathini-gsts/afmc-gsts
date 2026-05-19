import api from "./api";

export const Pubmenubuyservice = {
  createOrder: (payload) => api.post("/Pubmenubuy/create", payload),
  getByOrderNumber: (orderNumber) => api.get(`/Pubmenubuy/${orderNumber}`),
  updateItemQuantity: (orderNumber, itemCode, delta) =>
    api.patch(`/Pubmenubuy/${orderNumber}/item/${itemCode}`, { delta }),
  deleteItem: (orderNumber, itemCode) => api.delete(`/Pubmenubuy/${orderNumber}/item/${itemCode}`),
  cancelOrder: (orderNumber) => api.delete(`/Pubmenubuy/${orderNumber}`),
  updateLineQuantity: (orderNumber, orderLineId, quantity) =>
    api.put(`/Pubmenubuy/${orderNumber}/line/${orderLineId}/quantity`, { quantity: Number(quantity) }),
  getOrderCocktailIngredients: (orderNumber, itemCode) =>
    api.get(`/Pubmenubuy/${orderNumber}/item/${itemCode}/ingredients`),
  updateOrderCocktailIngredients: (orderNumber, itemCode, ingredients) =>
    api.put(`/Pubmenubuy/${orderNumber}/item/${itemCode}/ingredients`, { ingredients }),
};

export default Pubmenubuyservice;
