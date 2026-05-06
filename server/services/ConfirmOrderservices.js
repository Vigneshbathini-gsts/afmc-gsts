const ConfirmOrdermodel = require("../models/ConfirmOrdermodel");

const confirmOrder = async (orderNumber, authUser, payload) =>
  ConfirmOrdermodel.confirmOrder(orderNumber, authUser, payload);

const getConfirmedOrderDetails = async (orderNumber) =>
  ConfirmOrdermodel.getConfirmedOrderDetails(orderNumber);

module.exports = {
  confirmOrder,
  getConfirmedOrderDetails,
};
