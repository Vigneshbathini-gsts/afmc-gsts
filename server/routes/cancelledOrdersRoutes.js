const express = require("express");
const router = express.Router();

const {
  getCancelledOrders,
} = require("../controllers/cancelledOrdersController");

router.get("/", getCancelledOrders);

module.exports = router;