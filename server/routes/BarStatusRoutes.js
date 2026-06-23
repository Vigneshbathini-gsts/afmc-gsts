const express = require("express")

const {getBarStatus,updateBarStatus} = require("../controllers/BarStatusController")
const authMiddleware = require("../middleware/authMiddleware")
const orderEvents = require("../utils/orderEvents")
const barStatusEvents = require("../utils/barStatusEvents")

const router = express.Router();

const adminOnly = (req, res, next) => {
  const roleId = Number(req.user?.ROLE_ID || req.user?.roleId || 0);

  if (roleId !== 10) {
    return res.status(403).json({
      success: false,
      message: "Only admin can update bar status",
    });
  }

  next();
};

router.get("/events", orderEvents.authenticateEventRequest, barStatusEvents.subscribe);
router.get("/", getBarStatus);
router.put("/", authMiddleware, adminOnly, updateBarStatus);

module.exports = router;
