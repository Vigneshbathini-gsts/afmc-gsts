// axios instance goes here
import axios from "axios";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL: API,
  headers: {
    "Content-Type": "application/json",
  },
});

// ================================
// Attach token automatically
// ================================
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ================================
// Handle unauthorized automatically
// ================================
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (
      err.response?.status === 401 &&
      !window.location.pathname.includes("/login")
    ) {
      localStorage.removeItem("token");
      localStorage.removeItem("authUser");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// ================================
// AUTH API
// ================================
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





// ================================
// USER MANAGEMENT API (Admin)
// ================================
export const userAPI = {
  getAll: () => api.get("/users"),
  getById: (id) => api.get(`/users/${id}`),
  create: (userData) => api.post("/users", userData),
  update: (id, userData) => api.put(`/users/${id}`, userData),
  delete: (id) => api.delete(`/users/${id}`),
};

// ================================
// ITEM / MENU API
// ================================
export const itemAPI = {
  getAll: () => api.get("/items"),
  getById: (id) => api.get(`/items/${id}`),
  create: (itemData) => api.post("/items", itemData),
  update: (id, itemData) => api.put(`/items/${id}`, itemData),
  delete: (id) => api.delete(`/items/${id}`),

  // image upload item
  createWithImage: (formData) =>
    api.post("/items", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  updateWithImage: (id, formData) =>
    api.put(`/items/${id}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

// ================================
// INVENTORY API
// ================================
export const inventoryAPI = {
  getAll: (params) => api.get("/inventory", { params }),
  getCategories: () => api.get("/inventory/categories"),
  getItems: (params) => api.get("/inventory/items", { params }),
  getSubCategories: (params) => api.get("/inventory/subcategories", { params }),
  getBarTypes: () => api.get("/inventory/bar-types"),
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
  getById: (id) => api.get(`/inventory/${id}`),
  addStock: (data) => api.post("/inventory/add-stock", data),
  updateStock: (id, data) => api.put(`/inventory/${id}`, data),
  deleteStock: (id) => api.delete(`/inventory/${id}`),
};

// ================================
// ORDERS API
// ================================
export const orderAPI = {
  // Common
  create: (orderData) => api.post("/orders", orderData),
  getAll: () => api.get("/orders"),
  getById: (id) => api.get(`/orders/${id}`),
  updateStatus: (id, data) => api.put(`/orders/${id}/status`, data),
  cancelOrder: (id, data) => api.put(`/orders/${id}/cancel`, data),

  // User
  getMyOrders: () => api.get("/orders/my-orders"),
  getActiveOrders: () => api.get("/orders/active"),

  // Kitchen
  getKitchenOrders: () => api.get("/orders/kitchen"),
  markPrepared: (id, data) => api.put(`/orders/${id}/prepare`, data),

  // Attendant
  getAttendantOrders: () => api.get("/orders/attendant"),

  // Admin
  getOrderHistory: () => api.get("/orders/history"),

  getOrderDetails: (orderNumber) => api.get(`/orders/details/${orderNumber}`),
};

// ================================
// DASHBOARD / REPORTS API
// ================================
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
};



// ================================
// OFFERS API
// ================================
export const offersAPI = {
  getAllOffers: () => api.get("/offers"),
  getOfferById: (id) => api.get(`/offers/${id}`),
  createOffer: (data) => api.post('/offers', data),
  updateOffer: (id, data) => api.put(`/offers/${id}`, data),
  getAllItemsForOffer: () => api.get("/offers/items"),
};

// ================================
// PRICE MANAGEMENT API
// ================================

export const priceAPI = {
  getItemByBarcode: (barcode) => api.get(`/price/barcode/${barcode}`),
  updateItemPrice: (data) => api.put("/price/price-update", data),
};

// ================================
// PROFIT MANAGEMENT API
// ================================
export const profitAPI = {
  getProfitData: () => api.get("/profit/report"),
  updateMemberPricing: (data) => api.put("/profit/member", data),
  updateNonMemberPricing: (data) => api.put("/profit/non-member", data),
};

// ================================
// COCKTAIL / BAR API
// ================================
export const cocktailAPI = {
  getAll: () => api.get("/cocktails"),
  create: (data) => api.post("/cocktails", data),
  update: (id, data) => api.put(`/cocktails/${id}`, data),
  delete: (id) => api.delete(`/cocktails/${id}`),
};

//Notification API

export const notificationAPI = {
  getStockOutNotifications: () => api.get("/notifications/stock-out"),
  markStockOutRead: (itemCode) =>
    api.put(`/notifications/stock-out/read/${itemCode}`),
};

export const cancelledOrdersAPI = {
  getCancelledOrders: (params) => api.get("/cancelled-orders", { params }),
};



export default api;
