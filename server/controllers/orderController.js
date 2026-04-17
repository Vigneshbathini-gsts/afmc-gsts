const {
  getActiveOrders,
  getAdminOrderHistory,
  getNonMemberByPhone,
  getOrderDetails,
  saveNonMember,
} = require("../models/orderModel");

exports.fetchActiveOrders = async (req, res) => {
  try {
    const { from = null, to = null, search = null } = req.query;
    const roleId = Number(req.user?.roleId);
    const userId = roleId === 30 ? req.user?.userId || null : null;

    const data = await getActiveOrders({
      from,
      to,
      search,
      userId,
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

exports.lookupNonMember = async (req, res) => {
  try {
    const { phone = "" } = req.query;
    const normalizedPhone = String(phone).trim();

    if (!normalizedPhone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required.",
      });
    }

    const data = await getNonMemberByPhone(normalizedPhone);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Failed to lookup non-member:", error);
    res.status(500).json({
      success: false,
      message: "Unable to lookup non-member.",
      error: error.message,
    });
  }
};

exports.createOrUpdateNonMember = async (req, res) => {
  try {
    const { firstName, lastName, phoneNumber } = req.body || {};
    const data = await saveNonMember({
      firstName,
      lastName,
      phoneNumber,
    });

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Failed to save non-member:", error);

    if (error.code === "INVALID_DATA") {
      return res.status(400).json({
        success: false,
        message: "Phone number and first name are required.",
      });
    }

    res.status(500).json({
      success: false,
      message: "Unable to save non-member.",
      error: error.message,
    });
  }
};
