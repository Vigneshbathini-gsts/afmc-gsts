const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const {
  createOrUpdateNonMember,
  fetchActiveOrders,
  fetchAdminOrderHistory,
  fetchAttendantOrders,
  fetchOrderHistoryUsers,
  fetchItemWiseReport,
  fetchOrderDetails,
  fetchOrderSummary,
  fetchOrderWiseReport,
  lookupNonMember,
  fetchUserOrderHistory,
} = require("../controllers/orderController");

const router = express.Router();

router.get("/active", authMiddleware, fetchActiveOrders);
router.get("/attendant", authMiddleware, fetchAttendantOrders);
router.get("/history", authMiddleware, fetchAdminOrderHistory);
router.get("/history/users", authMiddleware, fetchOrderHistoryUsers);
router.get("/history/order-wise", authMiddleware, fetchOrderWiseReport);
router.get("/history/item-wise", authMiddleware, fetchItemWiseReport);
router.get("/non-member", authMiddleware, lookupNonMember);
router.post("/non-member", authMiddleware, createOrUpdateNonMember);
router.get("/user/history", authMiddleware, fetchUserOrderHistory);
router.get("/:id/summary", authMiddleware, fetchOrderSummary);
router.get("/:id/details", authMiddleware, fetchOrderDetails);
router.get("/:id", authMiddleware, fetchOrderDetails);

module.exports = router;


