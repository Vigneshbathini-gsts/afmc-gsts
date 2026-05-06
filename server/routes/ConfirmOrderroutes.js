const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const ConfirmOrdercontroller = require("../controllers/ConfirmOrdercontroller");

const router = express.Router();

router.post(
  "/confirm-order/:ORDER_NUMBER",
  authMiddleware,
  ConfirmOrdercontroller.confirmOrder
);
router.get(
  "/confirm-order/:ORDER_NUMBER",
  authMiddleware,
  ConfirmOrdercontroller.getConfirmedOrderDetails
);

module.exports = router;
