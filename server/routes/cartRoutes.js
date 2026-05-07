const express = require("express");
const cartController = require("../controllers/cartController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", authMiddleware, cartController.addCartItem);
router.post("/confirm-order", authMiddleware, cartController.confirmOrder);
router.get("/", authMiddleware, cartController.getCartItems);
router.get("/cocktail/:cartId", authMiddleware, cartController.getCocktailDetails);
router.patch("/cocktail/:cartId/ingredients", authMiddleware, cartController.updateCocktailIngredients);
router.patch("/:cartId", authMiddleware, cartController.updateCartItemQuantity);
router.delete("/:cartId", authMiddleware, cartController.deleteCartItem);
router.get("/lov-ingredients", authMiddleware, cartController.getLovIngredients);

module.exports = router;


