// payment routes


const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const router = express.Router();

const {
  getPaymentModes,
  updatePayment,
} = require("../controllers/paymentController");

const validatePayment = require("../middleware/validatePayment");

router.get("/modes", authMiddleware, getPaymentModes);
router.put("/update", authMiddleware, validatePayment, updatePayment);

module.exports = router;