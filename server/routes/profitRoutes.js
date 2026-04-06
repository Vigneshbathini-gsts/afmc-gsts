const express = require("express");
const router = express.Router();

const {
  updateMemberPricing,
  updateNonMemberPricing,
  getPricingReport,
} = require("../controllers/profitManagementController");

router.put("/member", updateMemberPricing);
router.put("/non-member", updateNonMemberPricing);
router.get("/report", getPricingReport);

module.exports = router;