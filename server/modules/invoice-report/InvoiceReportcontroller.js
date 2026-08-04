const invoiceReportService = require("./InvoiceReportservice");

exports.getInvoiceReportByOrderNumber = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const data = await invoiceReportService.getInvoiceReportByOrderNumber(orderNumber);
    console.log("Invoice report data fetched successfully for order number:", data);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Fetch invoice report error:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch invoice report",
    });
  }
};
