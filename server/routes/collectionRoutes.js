const express = require("express");
const router = express.Router();
const {
  getCollectionByOrder,
  addToCollection,
  updateCollectionItem,
  deleteFromCollection,
  clearCollection,
  getScannedQuantityByItem,
  getCollectionSummary,
} = require("../controllers/collectionController");
const authMiddleware = require("../middleware/authMiddleware");

// GET collection for order
router.get("/:orderNumber", authMiddleware, getCollectionByOrder);

// GET collection summary
router.get("/:orderNumber/summary", authMiddleware, getCollectionSummary);

// GET scanned quantity by item
router.get("/:orderNumber/item/:itemCode", authMiddleware, getScannedQuantityByItem);

// POST add item to collection
router.post("/", authMiddleware, addToCollection);

// PUT update collection item
router.put("/:id", authMiddleware, updateCollectionItem);

// DELETE item from collection
router.delete("/:id", authMiddleware, deleteFromCollection);

// DELETE clear entire collection
router.delete("/:orderNumber/clear", authMiddleware, clearCollection);

module.exports = router;
