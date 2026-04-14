const {
  getCocktailItems,
  getCocktailIngredientOptions,
  getCocktailIngredientPricing,
  getCocktailItemById,
  createCocktailItem,
  updateCocktailItem,
} = require("../models/cocktailModel");

const getAuditUserName = (req) =>
  req.user?.username ||
  req.body?.createdBy ||
  req.body?.updatedBy ||
  "SYSTEM";

const getCocktails = async (req, res) => {
  try {
    const rows = await getCocktailItems(req.query.search);

    res.json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error("Cocktail fetch error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching cocktail items",
      error: error.message,
    });
  }
};

const getCocktailById = async (req, res) => {
  try {
    const itemId = Number(req.params.id);

    if (!Number.isInteger(itemId) || itemId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid item id is required",
      });
    }

    const row = await getCocktailItemById(itemId);

    if (!row) {
      return res.status(404).json({
        success: false,
        message: "Cocktail item not found",
      });
    }

    return res.json({
      success: true,
      data: row,
    });
  } catch (error) {
    console.error("Cocktail item fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching cocktail item",
      error: error.message,
    });
  }
};

const getCocktailIngredients = async (req, res) => {
  try {
    const rows = await getCocktailIngredientOptions(req.query.search);

    return res.json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error("Cocktail ingredient fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching cocktail ingredients",
      error: error.message,
    });
  }
};

const getCocktailIngredientPrice = async (req, res) => {
  try {
    const data = await getCocktailIngredientPricing(
      req.query.itemCode,
      req.query.pegs
    );

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Cocktail ingredient price error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Error calculating ingredient price",
    });
  }
};

const createCocktail = async (req, res) => {
  try {
    const result = await createCocktailItem(req.body, {
      userName: getAuditUserName(req),
      imageFile: req.file || null,
    });

    return res.status(201).json({
      success: true,
      message: "Cocktail item created successfully",
      data: result,
    });
  } catch (error) {
    console.error("Cocktail create error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Error creating cocktail item",
    });
  }
};

const updateCocktail = async (req, res) => {
  try {
    const itemId = Number(req.params.id);

    if (!Number.isInteger(itemId) || itemId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid item id is required",
      });
    }

    const result = await updateCocktailItem(itemId, req.body, {
      userName: getAuditUserName(req),
      imageFile: req.file || null,
    });

    return res.json({
      success: true,
      message: "Cocktail item updated successfully",
      data: result,
    });
  } catch (error) {
    console.error("Cocktail update error:", error);
    const statusCode = error.message === "Cocktail item not found" ? 404 : 400;

    return res.status(statusCode).json({
      success: false,
      message: error.message || "Error updating cocktail item",
    });
  }
};

module.exports = {
  getCocktails,
  getCocktailIngredients,
  getCocktailIngredientPrice,
  getCocktailById,
  createCocktail,
  updateCocktail,
};
