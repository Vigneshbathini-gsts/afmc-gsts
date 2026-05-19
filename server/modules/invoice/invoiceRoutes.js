const express = require("express");
const authMiddleware = require("../../middleware/authMiddleware");
const {
  createInvoice,
  getInvoiceByOrder,
  saveInvoicePayment,
} = require("./invoiceController");

const router = express.Router();

// Get invoice details by order number
router.get("/:orderNumber", authMiddleware, getInvoiceByOrder);

// Create new invoice
router.post("/create", authMiddleware, createInvoice);

// Save invoice payment (if function exists in controller)
router.post("/:orderNumber/payment", authMiddleware, (req, res, next) => {
  if (saveInvoicePayment) {
    return saveInvoicePayment(req, res, next);
  }
  res.status(404).json({ error: "Payment endpoint not available" });
});

module.exports = router;
