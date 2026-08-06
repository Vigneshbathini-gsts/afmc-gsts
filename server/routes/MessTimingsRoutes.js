const express = require("express");

const {
  getWeeklyTimings,
  updateWeeklyTimings,
} = require("../controllers/MessTimingsController");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

const adminOnly = (req, res, next) => {
  const roleId = Number(req.user?.ROLE_ID || req.user?.roleId || 0);

  if (roleId !== 10) {
    return res.status(403).json({
      success: false,
      message: "Only admin can update mess timings",
    });
  }

  next();
};

router.get("/", getWeeklyTimings);

router.put(
  "/",
  authMiddleware,
  adminOnly,
  updateWeeklyTimings
);

module.exports = router;