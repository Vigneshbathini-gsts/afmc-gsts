const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const {
  createOrUpdateNonMember,
  fetchActiveOrders,
  fetchAdminOrderHistory,
  fetchAttendantOrders,
  fetchOrderDetails,
  lookupNonMember,
} = require("../controllers/orderController");

const router = express.Router();

router.get("/active", authMiddleware, fetchActiveOrders);
router.get("/attendant", authMiddleware, fetchAttendantOrders);
router.get("/history", authMiddleware, fetchAdminOrderHistory);
router.get("/non-member", authMiddleware, lookupNonMember);
router.post("/non-member", authMiddleware, createOrUpdateNonMember);
router.get("/:id", authMiddleware, fetchOrderDetails);

module.exports = router;
