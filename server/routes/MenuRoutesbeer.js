const express = require("express");
const router = express.Router();
const menuControllerbeer = require('../controllers/MenuControllerbeer');
const memuPopupController = require("../controllers/memupopupcontroller");
const authMiddleware = require("../middleware/authMiddleware");
const barStatusMiddleware = require("../middleware/barStatusMiddleware");

const checkBarOpen = [authMiddleware, barStatusMiddleware];

router.get("/menubar", checkBarOpen, menuControllerbeer.getInventory);
router.get("/fetchmocktail", checkBarOpen, menuControllerbeer.fetchmenubar);
router.get("/Snacksveg", checkBarOpen, menuControllerbeer.Snacksveg);
router.get("/Snakcnonveg", checkBarOpen, menuControllerbeer.Stacknonveg);
router.get("/memupopup", checkBarOpen, memuPopupController.getMenuPopupDetails);
router.get("/Drinkhardbeer", checkBarOpen, menuControllerbeer.Drinkhardbeer);
router.get("/Drinkhardbrandy", checkBarOpen, menuControllerbeer.Drinkhardbrandy);
router.get("/Drinkhardbreezer", checkBarOpen, menuControllerbeer.Drinkhardbreezer);
router.get("/Drinkhardvodka", checkBarOpen, menuControllerbeer.Drinkhardvodka);
router.get("/DrinkhardGin", checkBarOpen, menuControllerbeer.DrinkhardGin);

router.get("/DrinkhardRum", checkBarOpen, menuControllerbeer.DrinkhardRum);
router.get("/DrinkhardWhisky", checkBarOpen, menuControllerbeer.DrinkhardWhisky);

router.get("/DrinkhardWine", checkBarOpen, menuControllerbeer.DrinkhardWine);


router.get("/DrinkhardLiquor", checkBarOpen, menuControllerbeer.DrinkhardLiquor);
router.get("/DrinkhardTequila", checkBarOpen, menuControllerbeer.DrinkhardTequila);
router.get("/DrinkhardCocktail", checkBarOpen, menuControllerbeer.DrinkhardCocktail);


module.exports = router;


