const Pubmenubuymodel = require("../models/Pubmenubuymodel");

const getOrderSummary = async (orderNumber) => {
  return Pubmenubuymodel.getOrderSummary(orderNumber);
};

const createOrder = async (payload, authUser) => {
  return Pubmenubuymodel.createOrder(payload, authUser);
};

module.exports = {
  createOrder,
  getOrderSummary,
};
