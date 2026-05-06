const Pubmenubuyservice = require("../services/Pubmenubuyservice");

exports.createPubMenuOrder = async (req, res) => {
  try {
    const data = await Pubmenubuyservice.createOrder(req.body, req.user);
    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      data,
    });
  } catch (error) {
    console.error("Create pub menu order error:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Server error while creating order",
    });
  }
};

exports.getPubMenuOrderSummary = async (req, res) => {
  try {
    const { ORDER_NUMBER } = req.params;
    if (!ORDER_NUMBER) {
      return res.status(400).json({
        success: false,
        message: "ORDER_NUMBER is required",
      });
    }

    const data = await Pubmenubuyservice.getOrderSummary(ORDER_NUMBER);
    return res.status(200).json({
      success: true,
      message: "Order summary fetched successfully",
      data,
    });
  } catch (error) {
    console.error("Fetch pub menu order summary error:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Server error while fetching order summary",
    });
  }
};

exports.cancelPubMenuOrder = async (req, res) => {
  try {
    const { ORDER_NUMBER } = req.params;
    if (!ORDER_NUMBER) {
      return res.status(400).json({
        success: false,
        message: "ORDER_NUMBER is required",
      });
    }

    const data = await Pubmenubuyservice.cancelOrder(ORDER_NUMBER);
    return res.status(200).json({
      success: true,
      message: "Order cancelled",
      data,
    });
  } catch (error) {
    console.error("Cancel pub menu order error:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Server error while cancelling order",
    });
  }
};
