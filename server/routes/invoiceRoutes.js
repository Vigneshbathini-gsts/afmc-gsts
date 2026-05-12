const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const router = express.Router();

const {
  createInvoice,
  getInvoiceByOrder,
} = require("../controllers/invoiceController");

router.post("/create", createInvoice);
router.get("/:orderNumber", authMiddleware, getInvoiceByOrder);

module.exports = router;