const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middleware/authMiddleware");
const messTimingsMiddleware = require("../../middleware/messTimingsMiddleware");
const PubmenubuyController = require("./PubmenubuyController");

const checkBarOpen = [authMiddleware, messTimingsMiddleware];

router.post("/Pubmenubuy/create", checkBarOpen, PubmenubuyController.createPubMenuOrder);
router.get("/Pubmenubuy/:ORDER_NUMBER", checkBarOpen, PubmenubuyController.getPubMenuOrderSummary);
router.patch("/Pubmenubuy/:ORDER_NUMBER/item/:ITEM_CODE", checkBarOpen, PubmenubuyController.updatePubMenuOrderItemQuantity);
router.put(
  "/Pubmenubuy/:ORDER_NUMBER/item/:ITEM_CODE/customization",
  checkBarOpen,
  PubmenubuyController.updatePubMenuOrderItemCustomization
);
router.delete("/Pubmenubuy/:ORDER_NUMBER/item/:ITEM_CODE", checkBarOpen, PubmenubuyController.deletePubMenuOrderItem);
router.delete("/Pubmenubuy/:ORDER_NUMBER", checkBarOpen, PubmenubuyController.cancelPubMenuOrder);
router.put(
  "/Pubmenubuy/:ORDER_NUMBER/line/:ORDER_LINE_ID/quantity",
  checkBarOpen,
  PubmenubuyController.updatePubMenuOrderLineQuantity
);

module.exports = router;
