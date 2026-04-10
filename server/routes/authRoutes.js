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
router.post("/change-password",authMiddleware, authController.changePassword);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);


module.exports = router;