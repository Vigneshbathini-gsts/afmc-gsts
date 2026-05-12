const orderService = require("../services/orderHistoryService");
const {
  successResponse,
  errorResponse,
} = require("../utils/responseHandler");

const getOrderHistory = async (req, res) => {
  try {
    const filters = {
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      username: req.query.username,
      appUser: req.user?.username,
    };

    const orders = await orderService.fetchOrderHistory(filters);

    return successResponse(res, "Order history fetched", orders);
  } catch (error) {
    console.error(error);
    return errorResponse(res, error.message);
  }
};

const getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;

    const details = await orderService.fetchOrderDetails(orderId);

    return successResponse(res, "Order details fetched", details);
  } catch (error) {
    console.error(error);
    return errorResponse(res, error.message);
  }
};
const getOrderDetails = async (req, res) => {
  try {
    const { orderNumber } = req.params;

    const data = await orderService.getOrderDetails(orderNumber);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Get Order Details Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch order details",
    });
  }
};
module.exports = {
  getOrderHistory,
  getOrderDetails,
  getOrderDetails,

};