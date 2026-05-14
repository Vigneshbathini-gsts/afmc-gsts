const invoiceModel = require("../models/invoiceModel");

exports.getInvoiceDetails = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const data = await invoiceModel.getInvoiceDetails(orderNumber);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Fetch invoice details error:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch invoice details",
    });
  }
};

exports.saveInvoicePayment = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const data = await invoiceModel.saveInvoicePayment(orderNumber, req.body, req.user || {});
    return res.status(200).json({
      success: true,
      message: "Invoice updated successfully",
      data,
    });
  } catch (error) {
    console.error("Save invoice payment error:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to save invoice payment",
    });
  }
};
