const db = require("../config/db");

const getCartItemsByUser = async (userId) => {
  const sql = `
    SELECT
      c.cart_id,
      xi.item_code,
      c.item_id,
      xi.item_name,
      xi.image,
      c.price,
      c.description,
      c.uom,
      c.quantity,
      c.total,
      c.created_by,
      c.creation_date,
      c.last_updated_by,
      c.last_updated_date,
      c.parent_code,
      c.subcategory,
      COALESCE(
        (SELECT SUM(stock_quantity) FROM xxafmc_stock_out WHERE item_code = xi.item_code),
        0
      ) AS stock_quantity
    FROM xxafmc_cart_items c
    INNER JOIN xxafmc_inventory xi ON c.item_id = xi.item_code
    WHERE c.user_id = ?
    ORDER BY c.creation_date DESC
  `;

  const [rows] = await db.execute(sql, [userId]);

  return rows.map((row) => {
    const quantity = Number(row.quantity || 0);
    const price = Number(row.price || 0);
    return {
      cartId: row.cart_id,
      itemCode: row.item_code,
      itemId: row.item_id,
      itemName: row.item_name,
      image: row.image,
      price,
      description: row.description,
      uom: row.uom,
      quantity,
      total: Number(row.total || price * quantity),
      createdBy: row.created_by,
      creationDate: row.creation_date,
      lastUpdatedBy: row.last_updated_by,
      lastUpdatedDate: row.last_updated_date,
      parentCode: row.parent_code,
      subcategory: row.subcategory,
      stockQuantity: Number(row.stock_quantity || 0),
      stockStatus: Number(row.stock_quantity || 0) === 0 ? "Out Of Stock" : "In Stock",
    };
  });
};

const updateCartItemQuantity = async (cartId, userId, quantity) => {
  if (quantity <= 0) {
    return deleteCartItem(cartId, userId);
  }

  const sql = `
    UPDATE xxafmc_cart_items
    SET quantity = ?,
        total = price * ?
    WHERE cart_id = ?
      AND user_id = ?
  `;

  const [result] = await db.execute(sql, [quantity, quantity, cartId, userId]);
  return result;
};

const deleteCartItem = async (cartId, userId) => {
  const sql = `DELETE FROM xxafmc_cart_items WHERE cart_id = ? AND user_id = ?`;
  const [result] = await db.execute(sql, [cartId, userId]);
  return result;
};

module.exports = {
  getCartItemsByUser,
  updateCartItemQuantity,
  deleteCartItem,
};
