const {
  getActiveOrders,
  getAdminOrderHistory,
  getOrderDetails,
} = require("../models/orderModel");

exports.fetchActiveOrders = async (req, res) => {
  try {
    const { from = null, to = null, search = null } = req.query;
    const appUser = req.user?.username || null;

    const data = await getActiveOrders({
      from,
      to,
      search,
      appUser,
    });

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Failed to fetch active orders:", error);
    res.status(500).json({
      success: false,
      message: "Unable to fetch active orders.",
      error: error.message,
    });
  }
};

exports.fetchAttendantOrders = async (req, res) => {
  try {
    const { from = null, to = null, search = null } = req.query;
    const appUser = req.user?.username || null;

    const data = await getActiveOrders({
      from,
      to,
      search,
      appUser,
    });

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Failed to fetch attendant active orders:", error);
    res.status(500).json({
      success: false,
      message: "Unable to fetch attendant active orders.",
      error: error.message,
    });
  }
};

exports.fetchAdminOrderHistory = async (req, res) => {
  try {
    const { from = null, to = null, username = null, app_user = null } = req.query;

    const data = await getAdminOrderHistory({
      from,
      to,
      username,
      appUser: app_user,
    });

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Failed to fetch admin order history:", error);
    res.status(500).json({
      success: false,
      message: "Unable to fetch order history.",
      error: error.message,
    });
  }
};

exports.fetchOrderDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await getOrderDetails(id);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Failed to fetch order details:", error);
    res.status(500).json({
      success: false,
      message: "Unable to fetch order details.",
      error: error.message,
    });
  }
};
