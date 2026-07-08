function resolveParentItemForScan({ forcedParentItem, recipeParentRows = [], standaloneRows = [], scanItemCode }) {
  const normalizedForcedParent = String(forcedParentItem || "").trim();
  if (normalizedForcedParent) {
    return normalizedForcedParent;
  }

  const standaloneParent = String((standaloneRows[0] && standaloneRows[0].item_id) || "").trim();
  if (standaloneParent) {
    return standaloneParent;
  }

  const recipeParent = String((recipeParentRows[0] && recipeParentRows[0].inventory_item_code) || "").trim();
  if (recipeParent) {
    return recipeParent;
  }

  return String(scanItemCode || "").trim();
}

module.exports = {
  resolveParentItemForScan,
};
