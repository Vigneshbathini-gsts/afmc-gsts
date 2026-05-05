import api from "./api";

export const Pubmenubuyservice = {
  getByOrderNumber: (orderNumber) => api.get(`/Pubmenubuy/${orderNumber}`),
};

export default Pubmenubuyservice;
