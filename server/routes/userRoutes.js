const express = require("express");
const userController = require("../controllers/userController");
const csvUpload = require("../utils/csvUploadMiddleware");

const router = express.Router();

router.get("/", userController.getAllUsers);
router.get("/roles/options", userController.getRoleOptions);
router.post(
  "/bulk-upload",
  csvUpload.single("file"),
  userController.bulkUploadUsers
);
router.get("/:id", userController.getUserById);
router.post("/", userController.createUser);
router.put("/:id", userController.updateUser);

module.exports = router;
