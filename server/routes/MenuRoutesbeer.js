const express = require("express");
const router = express.Router();
const menuControllerbeer = require('../controllers/MenuControllerbeer');
const memuPopupController = require("../controllers/memupopupcontroller");
router.get("/menubar", menuControllerbeer.getInventory);
router.get("/fetchmocktail", menuControllerbeer.fetchmenubar);
router.get("/Snacksveg", menuControllerbeer.Snacksveg);
router.get("/Snakcnonveg", menuControllerbeer.Stacknonveg);
router.get("/memupopup", memuPopupController.getMenuPopupDetails);
router.get("/Drinkhardbeer", menuControllerbeer.Drinkhardbeer);
router.get("/Drinkhardbrandy", menuControllerbeer.Drinkhardbrandy);
router.get("/Drinkhardbreezer", menuControllerbeer.Drinkhardbreezer);
router.get("/Drinkhardvodka", menuControllerbeer.Drinkhardvodka);
router.get("/DrinkhardGin", menuControllerbeer.DrinkhardGin);

router.get("/DrinkhardRum", menuControllerbeer.DrinkhardRum);
router.get("/DrinkhardWhisky", menuControllerbeer.DrinkhardWhisky);

router.get("/DrinkhardWine", menuControllerbeer.DrinkhardWine);


router.get("/DrinkhardLiquor", menuControllerbeer.DrinkhardLiquor);
router.get("/DrinkhardTequila", menuControllerbeer.DrinkhardTequila);
router.get("/DrinkhardCocktail", menuControllerbeer.DrinkhardCocktail);






module.exports = router;
