const express = require("express");
const cartController = require("./cartController");
const authMiddleware = require("../../middleware/authMiddleware");
const barStatusMiddleware = require("../../middleware/barStatusMiddleware");

const router = express.Router();

const checkBarOpen = [authMiddleware, barStatusMiddleware];

router.post("/", checkBarOpen, cartController.addCartItem);
router.post("/add", checkBarOpen, cartController.addCartItem);
router.post("/proceed-to-buy", checkBarOpen, cartController.proceedToBuy);
router.post("/confirm-order", checkBarOpen, cartController.confirmOrder);
router.get("/", checkBarOpen, cartController.getCartItems);
router.get("/cocktail/:cartId", checkBarOpen, cartController.getCocktailDetails);
router.patch("/cocktail/:cartId/ingredients", checkBarOpen, cartController.updateCocktailIngredients);
router.put("/customize/:cartId", checkBarOpen, cartController.updateCocktailIngredients);
router.patch("/:cartId", checkBarOpen, cartController.updateCartItemQuantity);
router.put("/quantity/:cartId", checkBarOpen, cartController.updateCartItemQuantity);
router.delete("/:cartId", checkBarOpen, cartController.deleteCartItem);
router.get("/lov-ingredients", checkBarOpen, cartController.getLovIngredients);
router.get("/ingredient-stocks", checkBarOpen, cartController.getIngredientStocks);
router.get("/item/:itemId/custom-details", checkBarOpen, cartController.getCustomItemDetails);
router.post("/item/:itemId/custom-details", checkBarOpen, cartController.saveCustomItemDetails);
router.delete("/item/:itemId/custom-details", checkBarOpen, cartController.clearCustomItemDetails);

module.exports = router;


