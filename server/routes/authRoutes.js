// auth routes
const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

// Route for user registration
router.post("/register", authController.createUser);

// Route for user login
router.post("/login", authController.loginUser);
router.post("/get-role", authController.getUserRole);

module.exports = router;