const express = require("express");
const router = express.Router();
const {
  getItemByBarcode,
  updateItemPrice,
} = require("../controllers/priceController");

router.get("/barcode/:barcode", getItemByBarcode);
router.put("/price-update", updateItemPrice);

module.exports = router;