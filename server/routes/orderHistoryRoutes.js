const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const router = express.Router();

const {
  fetchAdminOrderHistory,
  fetchOrderDetails,
} = require("../controllers/orderController");

router.get("/history", authMiddleware, fetchAdminOrderHistory);
router.get("/:orderId/details", authMiddleware, fetchOrderDetails);
router.get("/:id/details", authMiddleware, fetchOrderDetails);      

module.exports = router;