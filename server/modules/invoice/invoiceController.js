const invoiceService = require("./invoiceService");
const {
  successResponse,
  errorResponse,
} = require("../../utils/responseHandler");

const createInvoice = async (req, res) => {
  try {
    const result = await invoiceService.createInvoice(req.body);

    return successResponse(res, "Invoice created", result);
  } catch (error) {
    return errorResponse(res, error.message);
  }
};

const getInvoiceByOrder = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const data = await invoiceService.fetchInvoiceByOrder(orderNumber);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found.",
      });
    }

    return successResponse(res, "Invoice fetched", data);
  } catch (error) {
    return errorResponse(res, error.message);
  }
};

module.exports = {
  createInvoice,
  getInvoiceByOrder,
  saveInvoicePayment: async (req, res) => {
    try {
      const { orderNumber } = req.params;
      const { paymentMode, paymentReference, paymentStatus } = req.body || {};

      const result = await invoiceService.saveInvoicePayment({
        orderNumber,
        paymentMode,
        paymentReference,
        paymentStatus,
        createdBy: req.user?.username || req.user?.userName || "SYSTEM",
      });

      return successResponse(res, "Payment saved", result);
    } catch (error) {
      return errorResponse(res, error.message);
    }
  },
};
