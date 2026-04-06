// notification routes
const express = require("express");
const router = express.Router();

const {
  getStockOutNotifications,
  markStockOutRead,
} = require("../controllers/notificationController");

router.get("/stock-out", getStockOutNotifications);
router.put("/stock-out/read/:itemCode", markStockOutRead);

module.exports = router;