const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const PubmenubuyController = require("../controllers/PubmenubuyController");

router.post("/Pubmenubuy/create", authMiddleware, PubmenubuyController.createPubMenuOrder);
router.get("/Pubmenubuy/:ORDER_NUMBER", authMiddleware, PubmenubuyController.getPubMenuOrderSummary);
router.patch("/Pubmenubuy/:ORDER_NUMBER/item/:ITEM_CODE", authMiddleware, PubmenubuyController.updatePubMenuOrderItemQuantity);
router.delete("/Pubmenubuy/:ORDER_NUMBER/item/:ITEM_CODE", authMiddleware, PubmenubuyController.deletePubMenuOrderItem);
router.delete("/Pubmenubuy/:ORDER_NUMBER", authMiddleware, PubmenubuyController.cancelPubMenuOrder);

module.exports = router;
