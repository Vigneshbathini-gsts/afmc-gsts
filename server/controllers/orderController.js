const { getAdminOrderHistory } = require("../models/orderModel");

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
