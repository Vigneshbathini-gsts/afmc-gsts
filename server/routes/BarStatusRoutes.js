const express = require("express")

const {getBarStatus,updateBarStatus} = require("../controllers/BarStatusController")

const router = express.Router();
router.get("/", getBarStatus);
router.put("/", updateBarStatus);

module.exports = router;