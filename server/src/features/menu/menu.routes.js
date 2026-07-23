const express = require("express");
const authMiddleware = require("../../../middleware/authMiddleware");
const barStatusMiddleware = require("../../../middleware/barStatusMiddleware");
const menuController = require("../../../controllers/MenuControllerbeer");
const menuPopupController = require("../../../controllers/memupopupcontroller");

const router = express.Router();
const checkBarOpen = [authMiddleware, barStatusMiddleware];

router.get("/bar-items", checkBarOpen, menuController.getInventory);
router.get("/mocktails", checkBarOpen, menuController.fetchmenubar);
router.get("/snacks/veg", checkBarOpen, menuController.Snacksveg);
router.get("/snacks/non-veg", checkBarOpen, menuController.Stacknonveg);
router.get("/popup", checkBarOpen, menuPopupController.getMenuPopupDetails);
router.get("/hard-drinks/beer", checkBarOpen, menuController.Drinkhardbeer);
router.get("/hard-drinks/brandy", checkBarOpen, menuController.Drinkhardbrandy);
router.get("/hard-drinks/breezer", checkBarOpen, menuController.Drinkhardbreezer);
router.get("/hard-drinks/vodka", checkBarOpen, menuController.Drinkhardvodka);
router.get("/hard-drinks/gin", checkBarOpen, menuController.DrinkhardGin);
router.get("/hard-drinks/rum", checkBarOpen, menuController.DrinkhardRum);
router.get("/hard-drinks/whisky", checkBarOpen, menuController.DrinkhardWhisky);
router.get("/hard-drinks/wine", checkBarOpen, menuController.DrinkhardWine);
router.get("/hard-drinks/liquor", checkBarOpen, menuController.DrinkhardLiquor);
router.get("/hard-drinks/tequila", checkBarOpen, menuController.DrinkhardTequila);
router.get("/hard-drinks/cocktails", checkBarOpen, menuController.DrinkhardCocktail);

module.exports = router;
