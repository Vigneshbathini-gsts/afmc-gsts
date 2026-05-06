const ConfirmOrderservices = require("../services/ConfirmOrderservices");

exports.confirmOrder = async (req, res) => {
  try {
    const { ORDER_NUMBER } = req.params;
    const data = await ConfirmOrderservices.confirmOrder(
      ORDER_NUMBER,
      req.user,
      req.body || {}
    );

    res.status(200).json({
      success: true,
      message: data.message,
      data,
    });
  } catch (error) {
    console.error("Confirm order error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to confirm order",
    });
  }
};

exports.getConfirmedOrderDetails = async (req, res) => {
  try {
    const { ORDER_NUMBER } = req.params;
    const data = await ConfirmOrderservices.getConfirmedOrderDetails(ORDER_NUMBER);

    res.status(200).json({
      success: true,
      message: "Confirmed order fetched successfully",
      data,
    });
  } catch (error) {
    console.error("Fetch confirmed order error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to fetch confirmed order",
    });
  }
};
