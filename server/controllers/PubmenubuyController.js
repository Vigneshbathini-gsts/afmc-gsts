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

exports.updatePubMenuOrderItemQuantity = async (req, res) => {
  try {
    const { ORDER_NUMBER, ITEM_CODE } = req.params;
    const { delta } = req.body || {};

    if (!ORDER_NUMBER || !ITEM_CODE) {
      return res.status(400).json({
        success: false,
        message: "ORDER_NUMBER and ITEM_CODE are required",
      });
    }

    const data = await Pubmenubuyservice.updateOrderItemQuantity(
      ORDER_NUMBER,
      ITEM_CODE,
      delta,
      req.user
    );

    return res.status(200).json({
      success: true,
      message: "Order item quantity updated",
      data,
    });
  } catch (error) {
    console.error("Update pub menu order item quantity error:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Server error while updating order item quantity",
    });
  }
};

exports.deletePubMenuOrderItem = async (req, res) => {
  try {
    const { ORDER_NUMBER, ITEM_CODE } = req.params;

    if (!ORDER_NUMBER || !ITEM_CODE) {
      return res.status(400).json({
        success: false,
        message: "ORDER_NUMBER and ITEM_CODE are required",
      });
    }

    const data = await Pubmenubuyservice.deleteOrderItem(ORDER_NUMBER, ITEM_CODE);

    return res.status(200).json({
      success: true,
      message: "Order item deleted",
      data,
    });
  } catch (error) {
    console.error("Delete pub menu order item error:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Server error while deleting order item",
    });
  }
};

exports.updatePubMenuOrderLineQuantity = async (req, res) => {
  try {
    const { ORDER_NUMBER, ORDER_LINE_ID } = req.params;
    const userId = req.user?.userId || req.user?.user_id;
    const { quantity } = req.body || {};

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    if (!ORDER_NUMBER) {
      return res.status(400).json({ success: false, message: "ORDER_NUMBER is required" });
    }

    if (!ORDER_LINE_ID) {
      return res.status(400).json({ success: false, message: "ORDER_LINE_ID is required" });
    }

    if (quantity === undefined || quantity === null || Number.isNaN(Number(quantity))) {
      return res.status(400).json({ success: false, message: "Valid quantity is required" });
    }

    const data = await Pubmenubuyservice.updateOrderLineQuantity(
      ORDER_NUMBER,
      ORDER_LINE_ID,
      userId,
      Number(quantity)
    );

    return res.status(200).json({
      success: true,
      message: "Quantity updated",
      data,
    });
  } catch (error) {
    console.error("Update pub menu order line quantity error:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Server error while updating quantity",
    });
  }
};
