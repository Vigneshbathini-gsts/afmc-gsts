// payment routes


const express = require("express");
const authMiddleware = require("../../middleware/authMiddleware");
const messTimingsMiddleware = require("../../middleware/messTimingsMiddleware");
const router = express.Router();

const {
  getPaymentModes,
  updatePayment,
} = require("./paymentController");

const validatePayment = require("./validatePayment");
const checkBarOpen = [authMiddleware, messTimingsMiddleware];

router.get("/modes", checkBarOpen, getPaymentModes);
router.put("/update", checkBarOpen, validatePayment, updatePayment);

module.exports = router;
