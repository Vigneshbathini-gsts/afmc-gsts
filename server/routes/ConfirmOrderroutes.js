const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const barStatusMiddleware = require("../middleware/barStatusMiddleware");
const ConfirmOrdercontroller = require("../controllers/ConfirmOrdercontroller");

const router = express.Router();
const checkBarOpen = [authMiddleware, barStatusMiddleware];

router.post(
  "/confirm-order/:ORDER_NUMBER",
  checkBarOpen,
  ConfirmOrdercontroller.confirmOrder
);
router.get(
  "/confirm-order/:ORDER_NUMBER",
  checkBarOpen,
  ConfirmOrdercontroller.getConfirmedOrderDetails
);

module.exports = router;
