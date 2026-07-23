const express = require("express");
const authMiddleware = require("../../../middleware/authMiddleware");
const barStatusMiddleware = require("../../../middleware/barStatusMiddleware");
const buyOrderController = require("../../../modules/pubmenubuy/PubmenubuyController");

const router = express.Router();
const checkBarOpen = [authMiddleware, barStatusMiddleware];

router.post("/", checkBarOpen, buyOrderController.createPubMenuOrder);

router.get("/:orderNumber", checkBarOpen, (req, res, next) => {
  req.params.ORDER_NUMBER = req.params.orderNumber;
  return buyOrderController.getPubMenuOrderSummary(req, res, next);
});

router.patch("/:orderNumber/items/:itemCode", checkBarOpen, (req, res, next) => {
  req.params.ORDER_NUMBER = req.params.orderNumber;
  req.params.ITEM_CODE = req.params.itemCode;
  return buyOrderController.updatePubMenuOrderItemQuantity(req, res, next);
});

router.put(
  "/:orderNumber/items/:itemCode/customization",
  checkBarOpen,
  (req, res, next) => {
    req.params.ORDER_NUMBER = req.params.orderNumber;
    req.params.ITEM_CODE = req.params.itemCode;
    return buyOrderController.updatePubMenuOrderItemCustomization(req, res, next);
  }
);

router.delete("/:orderNumber/items/:itemCode", checkBarOpen, (req, res, next) => {
  req.params.ORDER_NUMBER = req.params.orderNumber;
  req.params.ITEM_CODE = req.params.itemCode;
  return buyOrderController.deletePubMenuOrderItem(req, res, next);
});

router.delete("/:orderNumber", checkBarOpen, (req, res, next) => {
  req.params.ORDER_NUMBER = req.params.orderNumber;
  return buyOrderController.cancelPubMenuOrder(req, res, next);
});

router.put(
  "/:orderNumber/lines/:orderLineId/quantity",
  checkBarOpen,
  (req, res, next) => {
    req.params.ORDER_NUMBER = req.params.orderNumber;
    req.params.ORDER_LINE_ID = req.params.orderLineId;
    return buyOrderController.updatePubMenuOrderLineQuantity(req, res, next);
  }
);

module.exports = router;
