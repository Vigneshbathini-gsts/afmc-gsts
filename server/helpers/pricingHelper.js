const NON_ALCOHOLIC_LIQUOR_SUBCATEGORY_IDS = [9, 6, 18, 4];

function isExcludedLiquorSubcategory(subCategory) {
  return NON_ALCOHOLIC_LIQUOR_SUBCATEGORY_IDS.includes(Number(subCategory));
}

function getPricingCondition(category) {
  switch (category) {
    case "Liquor":
      return `CATEGORY_ID = 10 AND SUB_CATEGORY NOT IN (${NON_ALCOHOLIC_LIQUOR_SUBCATEGORY_IDS.join(", ")}) AND TRIM(UPPER(IFNULL(FLAG, ''))) = 'Y'`;

    case "Snacks":
      return "CATEGORY_ID = 14 AND SUB_CATEGORY IN (7, 10) AND TRIM(UPPER(IFNULL(FLAG, ''))) = 'Y'";

    default:
      return null;
  }
}

module.exports = {
  getPricingCondition,
  NON_ALCOHOLIC_LIQUOR_SUBCATEGORY_IDS,
  isExcludedLiquorSubcategory,
};

