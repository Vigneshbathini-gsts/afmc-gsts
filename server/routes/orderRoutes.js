const express = require("express");
const {
  fetchAdminOrderHistory,
  fetchOrderDetails,
} = require("../controllers/orderController");

const router = express.Router();

router.get("/history", fetchAdminOrderHistory);
router.get("/:id", fetchOrderDetails);

module.exports = router;
