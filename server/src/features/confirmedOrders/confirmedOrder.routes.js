const express = require("express");
const authMiddleware = require("../../../middleware/authMiddleware");
const barStatusMiddleware = require("../../../middleware/barStatusMiddleware");
const confirmedOrderController = require("../../../controllers/ConfirmOrdercontroller");

const router = express.Router();
const checkBarOpen = [authMiddleware, barStatusMiddleware];

router.post("/:orderNumber", checkBarOpen, (req, res, next) => {
  req.params.ORDER_NUMBER = req.params.orderNumber;
  return confirmedOrderController.confirmOrder(req, res, next);
});

router.get("/:orderNumber", checkBarOpen, (req, res, next) => {
  req.params.ORDER_NUMBER = req.params.orderNumber;
  return confirmedOrderController.getConfirmedOrderDetails(req, res, next);
});

module.exports = router;
