const express = require("express");
const cartController = require("../controllers/cartController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", authMiddleware, cartController.addCartItem);
router.post("/add", authMiddleware, cartController.addCartItem);
router.post("/confirm-order", authMiddleware, cartController.confirmOrder);
router.get("/", authMiddleware, cartController.getCartItems);
router.get("/cocktail/:cartId", authMiddleware, cartController.getCocktailDetails);
router.patch("/cocktail/:cartId/ingredients", authMiddleware, cartController.updateCocktailIngredients);
router.put("/customize/:cartId", authMiddleware, cartController.updateCocktailIngredients);
router.patch("/:cartId", authMiddleware, cartController.updateCartItemQuantity);
router.put("/quantity/:cartId", authMiddleware, cartController.updateCartItemQuantity);
router.delete("/:cartId", authMiddleware, cartController.deleteCartItem);
router.get("/lov-ingredients", authMiddleware, cartController.getLovIngredients);
router.get("/item/:itemId/custom-details", authMiddleware, cartController.getCustomItemDetails);
router.post("/item/:itemId/custom-details", authMiddleware, cartController.saveCustomItemDetails);
router.delete("/item/:itemId/custom-details", authMiddleware, cartController.clearCustomItemDetails);

module.exports = router;


