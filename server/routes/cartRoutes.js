const express = require("express");
const cartController = require("../controllers/cartController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", authMiddleware, cartController.addCartItem);
router.get("/", authMiddleware, cartController.getCartItems);
router.patch("/:cartId", authMiddleware, cartController.updateCartItemQuantity);
router.delete("/:cartId", authMiddleware, cartController.deleteCartItem);

module.exports = router;


