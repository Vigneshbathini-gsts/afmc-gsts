import api, { API_BASE_URL, authFetchJson } from "./apiClient";

export { API_BASE_URL, authFetchJson };

export const authAPI = {
  login: (credentials) => api.post("/auth/login", credentials),
  getRole: (data) => api.post("/auth/get-role", data),
  register: (userData) => api.post("/auth/register", userData),
  getProfile: () => api.get("/auth/profile"),
  changePassword: (data) => api.post("/auth/change-password", data),
  forgotPassword: (data) => api.post("/auth/forgot-password", data),
  resetPassword: (data) => api.post("/auth/reset-password", data),
  logout: () => api.post("/auth/logout"),
};

export const userAPI = {
  getAll: (search = "") =>
    api.get("/users", {
      params: search ? { search } : undefined,
    }),
  getById: (id) => api.get(`/users/${id}`),
  getRoleOptions: (loginType = "Member") =>
    api.get("/users/roles/options", {
      params: { loginType },
    }),
  create: (userData) => api.post("/users", userData),
  bulkUpload: (formData) =>
    api.post("/users/bulk-upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  update: (id, userData) => api.put(`/users/${id}`, userData),
  delete: (id) => api.delete(`/users/${id}`),
};

export const itemAPI = {
  getAll: () => api.get("/items"),
  getById: (id) => api.get(`/items/${id}`),
  create: (itemData) => api.post("/items", itemData),
  update: (id, itemData) => api.put(`/items/${id}`, itemData),
  delete: (id) => api.delete(`/items/${id}`),
  createWithImage: (formData) =>
    api.post("/items", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  updateWithImage: (id, formData) =>
    api.put(`/items/${id}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

export const inventoryAPI = {
  getAll: (params) => api.get("/inventory", { params }),
  getCategories: () => api.get("/inventory/categories"),
  getItems: (params) => api.get("/inventory/items", { params }),
  getSubCategories: (params) => api.get("/inventory/subcategories", { params }),
  getBarTypes: () => api.get("/inventory/bar-types"),
  checkBarcodeExists: (barcode) => api.get(`/inventory/barcode/${barcode}/exists`),
  createWithImage: (formData) =>
    api.post("/inventory", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  updateImage: (itemCode, formData) =>
    api.put(`/inventory/${itemCode}/image`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  getStockInReport: (params) => api.get("/inventory/stock-in-report", { params }),
  getStockOutReport: (params) => api.get("/inventory/stock-out-report", { params }),
  getTodayStockOutDetails: () => api.get("/inventory/today-stock-out-details"),
  getStockOutItemByBarcode: (barcode) =>
    api.get(`/inventory/stock-out/barcode/${barcode}`),
  createStockOut: (data) => api.post("/inventory/stock-out", data),
  getById: (id) => api.get(`/inventory/${id}`),
  addStock: (data) => api.post("/inventory/add-stock", data),
  updateStock: (id, data) => api.put(`/inventory/${id}`, data),
  deleteStock: (id) => api.delete(`/inventory/${id}`),
};

export const cartAPI = {
  getByUserId: (userId) => api.get("/cart", { params: { userId } }),
  addItem: (cartData) => api.post("/cart", cartData),
  addNewItem: (cartData) => api.post("/cart/add", cartData),
  proceedToBuy: (data = {}) => api.post("/cart/proceed-to-buy", data),
  getCocktailDetails: (cartId, params) =>
    api.get(`/cart/cocktail/${cartId}`, { params }),
  updateCocktailIngredients: (cartId, data) =>
    api.patch(`/cart/cocktail/${cartId}/ingredients`, data),
  customizeCocktail: (cartId, data) => api.put(`/cart/customize/${cartId}`, data),
  getIngredientStocks: (codes, orderNumber, buyOrderNumber, excludeCartId) =>
    api.get("/cart/ingredient-stocks", {
      params: {
        codes: Array.isArray(codes) ? codes.join(",") : codes,
        orderNumber: orderNumber || undefined,
        buyOrderNumber: buyOrderNumber || undefined,
        excludeOrderNumber: orderNumber || buyOrderNumber || undefined,
        excludeCartId: excludeCartId || undefined,
      },
    }),
  updateQuantity: (cartId, quantity) => api.patch(`/cart/${cartId}`, { quantity }),
  deleteItem: (cartId) => api.delete(`/cart/${cartId}`),
  confirmOrder: (data) => api.post("/cart/confirm-order", data),
  getLovIngredients: (subCategory) =>
    api.get("/cart/lov-ingredients", { params: { subCategory } }),
  getCustomItemDetails: (itemId) => api.get(`/cart/item/${itemId}/custom-details`),
  saveCustomItemDetails: (itemId, data) =>
    api.post(`/cart/item/${itemId}/custom-details`, data),
  clearCustomItemDetails: (itemId) =>
    api.delete(`/cart/item/${itemId}/custom-details`),
};

export const orderAPI = {
  create: (orderData) => api.post("/orders", orderData),
  getAll: () => api.get("/orders"),
  getById: (id) => api.get(`/orders/${id}`),
  getOrderDetails: (id) => api.get(`/orders/${id}`),
  updateStatus: (id, data) => api.put(`/orders/${id}/status`, data),
  cancelOrder: (id, data) => api.put(`/orders/${id}/cancel`, data),
  getMyOrders: () => api.get("/orders/my-orders"),
  getActiveOrders: (params) => api.get("/orders/active", { params }),
  getUserOrderHistory: (params) => api.get("/orders/user/history", { params }),
  getKitchenOrders: () => api.get("/orders/kitchen"),
  markPrepared: (id, data) => api.put(`/orders/${id}/prepare`, data),
  getAttendantOrders: (params) => api.get("/orders/attendant", { params }),
  lookupNonMember: (phone) =>
    api.get("/orders/non-member", {
      params: { phone },
    }),
  saveNonMember: (data) => api.post("/orders/non-member", data),
  getOrderHistory: (params) => api.get("/orders/history", { params }),
  getOrderSummary: (orderNumber) => api.get(`/orders/${orderNumber}/summary`),
};

export const dashboardAPI = {
  getAdminStats: () => api.get("/dashboard/admin"),
  getKitchenStats: () => api.get("/dashboard/kitchen"),
  getUserStats: () => api.get("/dashboard/user"),
  getAttendantStats: () => api.get("/dashboard/attendant"),
};

export const reportAPI = {
  getSalesReport: () => api.get("/reports/sales"),
  getProfitReport: () => api.get("/reports/profit"),
  getCancelledOrdersReport: () => api.get("/reports/cancelled-orders"),
  getStockReport: (params) => api.get("/reports/stock-report", { params }),
  getOrderItemReport: (params) => api.get("/reports/orderitem", { params }),
  getOrderItemFilterOptions: (params) =>
    api.get("/reports/orderitem/filter-options", { params }),
  getOrderTransactionReport: (params) =>
    api.get("/reports/ordertransaction", { params }),
  getOrderTransactionItems: () => api.get("/reports/ordertransaction/items"),
  getOrderTransactionUsers: () => api.get("/reports/ordertransaction/users"),
  getOrderTransactionKitchens: () =>
    api.get("/reports/ordertransaction/kitchens"),
};

export const barOrdersAPI = {
  getOrders: (kitchen) => api.get("/bar-orders", { params: { kitchen } }),
  updateStatus: (data) => api.put("/bar-orders/status", data),
  getOrderItems: (data) => api.post("/bar-orders/items", data),
  processScan: (data) => api.post("/bar-orders/scan", data),
  getScannedItems: (orderNumber) =>
    api.get(`/bar-orders/scanned-items/${orderNumber}`),
  clearScannedItems: (orderNumber) =>
    api.delete(`/bar-orders/scanned-items/${orderNumber}`),
  cancelItem: (data) => api.put("/bar-orders/cancel", data),
  cancelOrder: (data) => api.put("/bar-orders/cancel", data),
  getActiveOrders: (kitchen = "Bar") =>
    api.get("/bar-orders/active", { params: { kitchen } }),
  markNotificationAsRead: (data) =>
    api.put("/bar-orders/notifications/read", data),
  markAllNotificationsAsRead: (data) =>
    api.put("/bar-orders/notifications/read-all", data),
  getCocktailDetailsById: (itemId, orderNumber) =>
    api.get(`/bar-orders/cocktail/${itemId}`, { params: { orderNumber } }),
  getCancelledOrders: (params) =>
    api.get("/bar-orders/cancelled-orders", { params }),
  getOrderHistory: (params) => api.get("/bar-orders/order-history", { params }),
  getOrderDetailsByOrderNumber: (orderNumber, kitchen) =>
    api.get(`/bar-orders/cancelled-order-details/${orderNumber}`, {
      params: { kitchen },
    }),
  getOrderHistoryItemDetails: (orderNumber, kitchen) =>
    api.get(`/bar-orders/order-history-details/${orderNumber}`, {
      params: { kitchen },
    }),
  completeOrder: (data) => api.post("/bar-orders/completeOrder", data),
};

export const collectionAPI = {
  getByOrder: (orderNumber) => api.get(`/collection/${orderNumber}`),
  add: (data) => api.post("/collection", data),
  update: (id, data) => api.put(`/collection/${id}`, data),
  delete: (id) => api.delete(`/collection/${id}`),
  clear: (orderNumber) => api.delete(`/collection/${orderNumber}/clear`),
  getScannedQuantity: (orderNumber, itemCode) =>
    api.get(`/collection/${orderNumber}/item/${itemCode}`),
  getSummary: (orderNumber) => api.get(`/collection/${orderNumber}/summary`),
};

export const offersAPI = {
  getAllOffers: () => api.get("/offers"),
  getOfferById: (id) => api.get(`/offers/${id}`),
  createOffer: (data) => api.post("/offers", data),
  updateOffer: (id, data) => api.put(`/offers/${id}`, data),
  getAllItemsForOffer: () => api.get("/offers/items"),
};

export const priceAPI = {
  getItemByBarcode: (barcode) => api.get(`/price/barcode/${barcode}`),
  updateItemPrice: (data) => api.put("/price/price-update", data),
};

export const profitAPI = {
  getProfitData: () => api.get("/profit/report"),
  updateMemberPricing: (data) => api.put("/profit/member", data),
  updateNonMemberPricing: (data) => api.put("/profit/non-member", data),
};

export const cocktailAPI = {
  getAll: (params) => api.get("/cocktails", { params }),
  getById: (id) => api.get(`/cocktails/${id}`),
  getIngredientOptions: (search = "", params = {}) =>
    api.get("/cocktails/ingredients/options", {
      params: { ...params, ...(search ? { search } : {}) },
    }),
  getIngredientPrice: (itemCode, pegs) =>
    api.get("/cocktails/ingredients/price", {
      params: { itemCode, pegs },
    }),
  create: (data) =>
    api.post("/cocktails", data, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  update: (id, data) =>
    api.put(`/cocktails/${id}`, data, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

export const notificationAPI = {
  getStockOutNotifications: () => api.get("/notifications/stock-out"),
  markStockOutRead: (itemCode) =>
    api.put(`/notifications/stock-out/read/${itemCode}`),
};

export const invoiceAPI = {
  getByOrderNumber: (orderNumber) => api.get(`/invoice/${orderNumber}`),
  savePayment: (orderNumber, data) =>
    api.post(`/invoice/${orderNumber}/payment`, data),
};

export const invoiceReportAPI = {
  getByOrderNumber: (orderNumber) => api.get(`/invoice-report/${orderNumber}`),
};

export const cancelledOrdersAPI = {
  getCancelledOrders: (params) => api.get("/cancelled-orders", { params }),
};

export const barStatusAPI = {
  getStatus: () => api.get("/bar-status"),
  updateStatus: (status) => api.put("/bar-status", { status }),
};

export default api;
