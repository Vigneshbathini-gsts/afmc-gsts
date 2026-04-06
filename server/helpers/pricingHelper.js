function getPricingCondition(category) {
  switch (category) {
    case "Liquor":
      return "CATEGORY_ID = 10 AND SUB_CATEGORY NOT IN (14, 15)";

    case "Snacks":
      return "CATEGORY_ID = 14 AND SUB_CATEGORY IN (7, 10)";

    default:
      return null;
  }
}

module.exports = { getPricingCondition };