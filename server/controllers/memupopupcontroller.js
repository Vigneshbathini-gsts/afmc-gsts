const memuPopupService = require("../services/memupopupservices");

const getMenuPopupDetails = async (req, res) => {
  try {
    const itemCode = Number(req.query.itemCode);
    const itemId = Number(req.query.itemId);

    if (!Number.isInteger(itemCode) || itemCode <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid itemCode is required",
      });
    }

    if (!Number.isInteger(itemId) || itemId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid itemId is required",
      });
    }

    const data = await memuPopupService.getMenuPopupDetails({
      itemCode,
      itemId,
    });

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Menu popup item not found",
      });
    }

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Menu popup fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching menu popup details",
      error: error.message,
    });
  }
};

module.exports = {
  getMenuPopupDetails,
};
