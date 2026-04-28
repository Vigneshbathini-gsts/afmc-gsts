const express = require("express");
const router = express.Router();
const inventoryController = require("../controllers/inventoryController");
const upload = require("../utils/uploadMiddleware");

router.get("/", inventoryController.getInventory);
router.get("/categories", inventoryController.getCategories);
router.get("/items", inventoryController.getItems); 
router.get("/subcategories", inventoryController.getSubCategories);
router.get("/bar-types", inventoryController.getBarTypes);
router.get("/barcode/:barcode/exists", inventoryController.checkBarcodeExists);
router.get("/stock-out/barcode/:barcode", inventoryController.getStockOutItemByBarcode);
router.get("/stock-in-report", inventoryController.getStockInReport);
router.get("/stock-out-report", inventoryController.getStockOutReport);
router.post("/", upload.single("image"), inventoryController.createItem);
router.put("/:itemCode/image", upload.single("image"), inventoryController.updateItemImage);
router.post("/add-stock", inventoryController.addStock);
router.post("/stock-out", inventoryController.addStockOut);

module.exports = router;
