const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  getItemByBarcode,
  updateItemPrice,
} = require("../controllers/priceController");

router.get("/barcode/:barcode",authMiddleware, getItemByBarcode);
router.put("/price-update", authMiddleware, updateItemPrice);

module.exports = router;