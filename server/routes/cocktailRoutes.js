const express = require("express");
const router = express.Router();
const cocktailController = require("../controllers/cocktailController");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/", authMiddleware, cocktailController.getAll);
router.get("/:id", authMiddleware, cocktailController.getById);
router.post("/", authMiddleware, cocktailController.create);
router.put("/:id", authMiddleware, cocktailController.update);
router.delete("/:id", authMiddleware, cocktailController.delete);

module.exports = router;



