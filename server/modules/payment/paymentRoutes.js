// payment routes


const express = require("express");
const authMiddleware = require("../../middleware/authMiddleware");
const barStatusMiddleware = require("../../middleware/barStatusMiddleware");
const router = express.Router();

const {
  getPaymentModes,
  updatePayment,
} = require("./paymentController");

const validatePayment = require("./validatePayment");
const checkBarOpen = [authMiddleware, barStatusMiddleware];

router.get("/modes", checkBarOpen, getPaymentModes);
router.put("/update", checkBarOpen, validatePayment, updatePayment);

module.exports = router;
