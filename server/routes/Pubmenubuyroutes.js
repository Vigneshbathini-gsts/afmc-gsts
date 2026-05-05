const express = require("express");
const router = express.Router();
const PubmenubuyController = require("../controllers/PubmenubuyController");

router.get("/Pubmenubuy/:ORDER_NUMBER", PubmenubuyController.PubmenubuyController);


module.exports = router;
