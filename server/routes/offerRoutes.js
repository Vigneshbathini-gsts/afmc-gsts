const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");

const {
  getAllOffers,
  getOfferById,
  createOffer,
  updateOffer,
  getAllItemsForOffer,
} = require("../controllers/offerController")

// IMPORTANT: specific routes first
router.get("/items", authMiddleware,getAllItemsForOffer);

router.get("/", authMiddleware,getAllOffers);
router.get("/:id", authMiddleware, getOfferById);
router.post("/", authMiddleware, createOffer);
router.put("/:id", authMiddleware, updateOffer);

module.exports = router;