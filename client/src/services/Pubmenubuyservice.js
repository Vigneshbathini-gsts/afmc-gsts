import api from "./api";

export const Pubmenubuyservice = {
  createOrder: (payload) => api.post("/Pubmenubuy/create", payload),
  getByOrderNumber: (orderNumber) => api.get(`/Pubmenubuy/${orderNumber}`),
};

export default Pubmenubuyservice;
