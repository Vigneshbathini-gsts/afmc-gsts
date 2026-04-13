// cocktail controller
const pool = require("../config/db");

exports.getAll = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        cm.cocktail_mocktail_id AS id,
        cm.COCKTAIL_MOCKTAIL_NAME AS name,
        xi.category_id,
        xi.sub_category,
        GROUP_CONCAT(
          JSON_OBJECT(
            'item_code', cmd.item_code,
            'item_name', xi2.item_name,
            'pegs', cmd.pegs,
            'quantity', cmd.quantity
          )
        ) AS ingredients_json
      FROM xxafmc_custom_cocktails_mocktails cm
      JOIN xxafmc_inventory xi ON cm.inventory_item_code = xi.item_code
      LEFT JOIN (
        SELECT * FROM xxafmc_custom_cocktails_mocktails_details
        UNION ALL
        SELECT * FROM xxafmc_custom_cocktails_mocktails_details_dummy
      ) cmd ON cm.cocktail_mocktail_id = cmd.cocktail_mocktail_id
      LEFT JOIN xxafmc_inventory xi2 ON cmd.item_code = xi2.item_code
      GROUP BY cm.cocktail_mocktail_id, cm.COCKTAIL_MOCKTAIL_NAME, xi.category_id, xi.sub_category
    `);

    const cocktails = rows.map(row => ({
      id: row.id,
      name: row.name,
      category_id: row.category_id,
      sub_category: row.sub_category,
      ingredients: row.ingredients_json ? JSON.parse(`[${row.ingredients_json}]`) : []
    }));

    res.status(200).json(cocktails);
  } catch (error) {
    console.error("Error fetching cocktails:", error);
    res.status(500).json({
      message: "Failed to fetch cocktails",
      error: error.message,
    });
  }
};

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const { orderNumber } = req.query;

    // Get cocktail name and type from inventory
    const [inventoryRows] = await pool.query(
      `SELECT item_name, category_id, sub_category FROM xxafmc_inventory WHERE item_code = ?`,
      [id]
    );

    if (inventoryRows.length === 0) {
      return res.status(404).json({
        message: "Cocktail not found in inventory",
      });
    }

    const { item_name: cocktailName, category_id, sub_category } = inventoryRows[0];
    const type = category_id === 14 ? "Kitchen" : "Bar";

    // Get ingredients from details tables; limit to the current order if provided
    const detailQuery = `
      SELECT DISTINCT
        cmd.item_code,
        xi.item_name,
        cmd.pegs,
        cmd.quantity
      FROM (
        SELECT item_code, pegs, quantity
        FROM xxafmc_custom_cocktails_mocktails_details
        WHERE inventory_item_code = ?
        ${orderNumber ? "AND order_number = ?" : ""}
        UNION ALL
        SELECT item_code, pegs, quantity
        FROM xxafmc_custom_cocktails_mocktails_details_dummy
        WHERE inventory_item_code = ?
        ${orderNumber ? "AND order_number = ?" : ""}
      ) cmd
      JOIN xxafmc_inventory xi ON cmd.item_code = xi.item_code
    `;

    const queryParams = orderNumber
      ? [id, orderNumber, id, orderNumber]
      : [id, id];

    const [detailRows] = await pool.query(detailQuery, queryParams);

    const ingredients = detailRows.map(row => ({
      item_code: row.item_code,
      item_name: row.item_name,
      pegs: row.pegs,
      quantity: row.quantity
    }));

    const cocktail = {
      id: id,
      name: cocktailName,
      type: type,
      ingredients: ingredients
    };

    res.status(200).json(cocktail);
  } catch (error) {
    console.error("Error fetching cocktail:", error);
    res.status(500).json({
      message: "Failed to fetch cocktail",
      error: error.message,
    });
  }
};

exports.create = async (req, res) => {
  // Implement if needed
  res.status(501).json({ message: "Not implemented" });
};

exports.update = async (req, res) => {
  // Implement if needed
  res.status(501).json({ message: "Not implemented" });
};

exports.delete = async (req, res) => {
  // Implement if needed
  res.status(501).json({ message: "Not implemented" });
};
