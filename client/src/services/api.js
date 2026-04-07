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
      localStorage.removeItem("user");
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
  changePassword: (data) => api.put("/auth/change-password", data),
  logout: () => api.post("/auth/logout"),
};

// ================================
// USER MANAGEMENT API (Admin)
// ================================
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
  getAll: () => api.get("/inventory"),
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
export const offerAPI = {
  getAll: () => api.get("/offers"),
  create: (data) => api.post("/offers", data),
  update: (id, data) => api.put(`/offers/${id}`, data),
  delete: (id) => api.delete(`/offers/${id}`),
};

// ================================
// PRICE MANAGEMENT API
// ================================
export const priceAPI = {
  updatePrice: (id, data) => api.put(`/items/${id}/price`, data),
};

// ================================
// PROFIT MANAGEMENT API
// ================================
export const profitAPI = {
  getProfitData: () => api.get("/profit"),
};

// ================================
// COCKTAIL / BAR API
// ================================
export const cocktailAPI = {
  getAll: () => api.get("/cocktails"),
  getIngredientOptions: (search = "") =>
    api.get("/cocktails/ingredients/options", {
      params: search ? { search } : undefined,
    }),
  getIngredientPrice: (itemCode, pegs) =>
    api.get("/cocktails/ingredients/price", {
      params: { itemCode, pegs },
    }),
  getById: (id) => api.get(`/cocktails/${id}`),
  create: (data) =>
    api.post("/cocktails", data, {
      headers:
        data instanceof FormData
          ? { "Content-Type": "multipart/form-data" }
          : undefined,
    }),
  update: (id, data) =>
    api.put(`/cocktails/${id}`, data, {
      headers:
        data instanceof FormData
          ? { "Content-Type": "multipart/form-data" }
          : undefined,
    }),
  delete: (id) => api.delete(`/cocktails/${id}`),
};

export default api;
