const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const invoiceReportController = require("../controllers/InvoiceReportcontroller");

const router = express.Router();

router.get(
  "/:orderNumber",
  authMiddleware,
  invoiceReportController.getInvoiceReportByOrderNumber
);

module.exports = router;
