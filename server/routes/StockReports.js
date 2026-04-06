const express = require("express");
const { getStockReport } = require("../controllers/StockReports");

const router = express.Router();

router.get("/stock-report", getStockReport);
router.get("/stock_report", getStockReport);

module.exports = router;
