const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const invoiceController = require("../controllers/invoiceController");

const router = express.Router();

router.get("/:orderNumber", authMiddleware, invoiceController.getInvoiceDetails);
router.post("/:orderNumber/payment", authMiddleware, invoiceController.saveInvoicePayment);

module.exports = router;
