const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const {
  fetchActiveOrders,
  fetchAttendantOrders,
  fetchAdminOrderHistory,
  fetchOrderDetails,
} = require("../controllers/orderController");

const router = express.Router();

router.get("/active", authMiddleware, fetchActiveOrders);
router.get("/attendant", authMiddleware, fetchAttendantOrders);
router.get("/history", fetchAdminOrderHistory);
router.get("/:id", authMiddleware, fetchOrderDetails);

module.exports = router;
