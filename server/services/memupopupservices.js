const memuPopupModel = require("../models/memupopupmodel");

const getMenuPopupDetails = async (params) => {
  return memuPopupModel.getMenuPopupDetails(params);
};

module.exports = {
  getMenuPopupDetails,
};
