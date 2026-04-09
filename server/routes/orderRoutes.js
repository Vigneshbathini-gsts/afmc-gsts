const express = require("express");
const { fetchAdminOrderHistory } = require("../controllers/orderController");

const router = express.Router();

router.get("/history", fetchAdminOrderHistory);

module.exports = router;
