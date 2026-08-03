const {
  getActiveOrders,
  getAdminOrderHistory,
  getOrderWiseReport,
  getItemWiseReport,
  getNonMemberByPhone,
  getOrderDetails,
  getOrderSummary,
  saveNonMember,
  getUserOrderHistory,
} = require("../models/orderModel");

exports.fetchActiveOrders = async (req, res) => {
  try {
    const { from = null, to = null, search = null } = req.query;
    const userId = req.user?.userId || null;

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
    const { from = null, to = null, username = null } = req.query;
    const roleId = Number(req.user?.roleId);
    const userId = roleId === 10 ? null : req.user?.userId || null;

    const data = await getAdminOrderHistory({
      from,
      to,
      username,
      userId,
    });
// console.log("Fetched Admin Order History:", data);
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

exports.fetchOrderWiseReport = async (req, res) => {
  try {
    const { orderDate = null, username = null, paymentStatus = null } = req.query;
    const roleId = Number(req.user?.roleId);
    const userId = roleId === 10 ? null : req.user?.userId || null;

    if (!orderDate) {
      return res.status(400).json({
        success: false,
        message: "orderDate is required.",
      });
    }

    const data = await getOrderWiseReport({
      orderDate,
      username,
      paymentStatus,
      userId,
    });

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Failed to fetch order-wise report:", error);
    res.status(500).json({
      success: false,
      message: "Unable to fetch order-wise report.",
      error: error.message,
    });
  }
};

exports.fetchItemWiseReport = async (req, res) => {
  try {
    const { orderDate = null, username = null, paymentStatus = null } = req.query;
    const roleId = Number(req.user?.roleId);
    const userId = roleId === 10 ? null : req.user?.userId || null;

    if (!orderDate) {
      return res.status(400).json({
        success: false,
        message: "orderDate is required.",
      });
    }

    const data = await getItemWiseReport({
      orderDate,
      username,
      paymentStatus,
      userId,
    });

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Failed to fetch item-wise report:", error);
    res.status(500).json({
      success: false,
      message: "Unable to fetch item-wise report.",
      error: error.message,
    });
  }
};

exports.fetchOrderDetails = async (req, res) => {
  try {
    const { id, orderId } = req.params;
    const orderIdentifier = id || orderId;
    const data = await getOrderDetails(orderIdentifier);
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

exports.fetchOrderSummary = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await getOrderSummary(id);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Failed to fetch order summary:", error);
    res.status(500).json({
      success: false,
      message: "Unable to fetch order summary.",
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

exports.fetchUserOrderHistory = async (req, res) => {
  try {
    const { from = null, to = null } = req.query;
    const appUser = req.user?.username || null;

    const data = await getUserOrderHistory({
      fromDate: from,
      toDate: to,
      appUser,
    }); 
// console.log("Fetched User Order History:", data);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Failed to fetch user order history:", error);
    res.status(500).json({  
      success: false,
      message: "Unable to fetch order history.",
      error: error.message,
    });
  } 
};

