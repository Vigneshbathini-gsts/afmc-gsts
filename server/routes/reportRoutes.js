const express = require("express");
const stockReportRoutes = require("./StockReports");
const orderTransactionRoutes = require("./ordertransactiondetails");
const orderItemRoutes = require("./orderitemdetails");

const router = express.Router();

router.use(stockReportRoutes);
router.use(orderTransactionRoutes);
router.use(orderItemRoutes);

module.exports = router;
