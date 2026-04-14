const express = require("express");
const {
  getCocktails,
  getCocktailIngredients,
  getCocktailIngredientPrice,
  getCocktailById,
  createCocktail,
  updateCocktail,
} = require("../controllers/cocktailController");
const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../utils/uploadMiddleware");

const router = express.Router();

router.get("/", getCocktails);
router.get("/ingredients/options", getCocktailIngredients);
router.get("/ingredients/price", getCocktailIngredientPrice);
router.post("/", authMiddleware, upload.single("image"), createCocktail);
router.get("/:id", getCocktailById);
router.put("/:id", authMiddleware, upload.single("image"), updateCocktail);

module.exports = router;
