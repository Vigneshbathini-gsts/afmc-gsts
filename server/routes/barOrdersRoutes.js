const express = require("express");
const router = express.Router();
const barOrdersController = require("../controllers/barOrdersController");
const authMiddleware = require("../middleware/authMiddleware");
router.get("/", authMiddleware, barOrdersController.getOrders);
router.put("/status", authMiddleware, barOrdersController.updateBarOrderStatus);
router.post("/items", authMiddleware, barOrdersController.getOrderItems);
router.post("/scan", authMiddleware, barOrdersController.processBarcodeScan);
router.put("/cancel", authMiddleware, barOrdersController.cancelBarOrderItem);

module.exports = router;