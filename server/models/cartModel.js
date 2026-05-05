const db = require("../config/db");

const addCartItem = async (userId, itemData) => {
  const { item_id, quantity = 1, unit_price = 0, remarks } = itemData;

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // -------------------------------
    // 1. CHECK EXISTING CART ITEM
    // -------------------------------
    const [existing] = await conn.execute(
      `SELECT cart_id, quantity FROM xxafmc_cart_items 
       WHERE user_id = ? AND item_id = ? AND price != 0`,
      [userId, item_id]
    );

    let newQty = quantity;

    if (existing.length > 0) {
      newQty = existing[0].quantity + quantity;

      await conn.execute(
        `UPDATE xxafmc_cart_items
         SET quantity = ?
         WHERE cart_id = ?`,
        [newQty, existing[0].cart_id]
      );
    } else {
      await conn.execute(
        `INSERT INTO xxafmc_cart_items
        (user_id, item_id, quantity, price, total, description, created_by, creation_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          userId,
          item_id,
          quantity,
          unit_price,
          unit_price * quantity,
          remarks || "Item",
          userId,
        ]
      );
    }

    // -------------------------------
    // 2. FETCH OFFER
    // -------------------------------
    const [offers] = await conn.execute(
      `SELECT * FROM xxafmc_offers
       WHERE item_code = ?
       AND (
         (END_DATE IS NULL AND CURDATE() >= DATE(OFFER_DATE))
         OR (CURDATE() BETWEEN DATE(OFFER_DATE) AND END_DATE)
       )
       LIMIT 1`,
      [item_id]
    );

    if (offers.length === 0) {
      await conn.commit();
      return { message: "Item added (no offer)" };
    }

    const offer = offers[0];

    const offerQty = offer.OFFER_QUANTITY;
    const freeItemCode = offer.FREE_ITEM_CODE;
    const freeItemQty = offer.FREE_ITEM_QUANTITY;

    // -------------------------------
    // 3. CHECK ELIGIBILITY
    // -------------------------------
    if (newQty < offerQty) {
      await conn.commit();
      return { message: "Item added (offer not applicable yet)" };
    }

    // -------------------------------
    // 4. CALCULATE FREE ITEMS
    // -------------------------------
    const totalFree = Math.floor(newQty / offerQty) * freeItemQty;

    // -------------------------------
    // 5. INSERT / UPDATE FREE ITEM
    // -------------------------------
    const [freeExisting] = await conn.execute(
      `SELECT cart_id FROM xxafmc_cart_items
       WHERE user_id = ? AND item_id = ? AND price = 0`,
      [userId, freeItemCode]
    );

    if (freeExisting.length > 0) {
      await conn.execute(
        `UPDATE xxafmc_cart_items
         SET quantity = ?
         WHERE cart_id = ?`,
        [totalFree, freeExisting[0].cart_id]
      );
    } else {
      await conn.execute(
        `INSERT INTO xxafmc_cart_items
        (user_id, item_id, quantity, price, total, description, created_by, creation_date)
        VALUES (?, ?, ?, 0, 0, ?, ?, NOW())`,
        [
          userId,
          freeItemCode,
          totalFree,
          "Free Item",
          userId,
        ]
      );
    }

    await conn.commit();

    return {
      message: "Item + free item added successfully",
      freeItem: {
        item_id: freeItemCode,
        quantity: totalFree,
      },
    };

  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const getCartItemsByUser = async (userId) => {
  const sql = `
    SELECT
      c.cart_id,
      xi.item_code,
      c.item_id,
      xi.item_name,
      xi.image,
      c.price,
      xi.unit_price AS inventory_price,
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
    const rawPrice = row.price != null ? row.price : row.inventory_price;
    const price = Number(rawPrice || 0);
    const description = String(row.description || "").trim();
    return {
      cartId: row.cart_id,
      itemCode: row.item_code,
      itemId: row.item_id,
      itemName: row.item_name,
      image: row.image,
      price,
      description,
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
      isFreeItem: price === 0 && description.toLowerCase().includes("free"),
    };
  });
};

const updateCartItemQuantity = async (cartId, userId, quantity) => {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    if (quantity <= 0) {
      return await deleteCartItem(cartId, userId);
    }

    // Get current item details
    const [current] = await conn.execute(
      `SELECT item_id, quantity FROM xxafmc_cart_items WHERE cart_id = ? AND user_id = ?`,
      [cartId, userId]
    );

    if (current.length === 0) {
      throw new Error('Cart item not found');
    }

    const itemId = current[0].item_id;
    const oldQty = current[0].quantity;

    // Update the main item quantity
    await conn.execute(
      `UPDATE xxafmc_cart_items
       SET quantity = ?, total = price * ?
       WHERE cart_id = ? AND user_id = ?`,
      [quantity, quantity, cartId, userId]
    );

    // Fetch offer
    const [offers] = await conn.execute(
      `SELECT * FROM xxafmc_offers
       WHERE ITEM_CODE = ?
       AND (
         (END_DATE IS NULL AND CURDATE() >= DATE(OFFER_DATE))
         OR (CURDATE() BETWEEN DATE(OFFER_DATE) AND END_DATE)
       )
       LIMIT 1`,
      [itemId]
    );

    if (offers.length > 0) {
      const offer = offers[0];
      const offerQty = offer.OFFER_QUANTITY;
      const freeItemCode = offer.FREE_ITEM_CODE;
      const freeItemQty = offer.FREE_ITEM_QUANTITY;

      // Calculate new free items
      const totalFree = Math.floor(quantity / offerQty) * freeItemQty;

      // Update or delete free item
      if (totalFree > 0) {
        const [freeExisting] = await conn.execute(
          `SELECT cart_id FROM xxafmc_cart_items
           WHERE user_id = ? AND item_id = ? AND price = 0`,
          [userId, freeItemCode]
        );

        if (freeExisting.length > 0) {
          await conn.execute(
            `UPDATE xxafmc_cart_items SET quantity = ? WHERE cart_id = ?`,
            [totalFree, freeExisting[0].cart_id]
          );
        } else {
          await conn.execute(
            `INSERT INTO xxafmc_cart_items
            (user_id, item_id, quantity, price, total, description, created_by, creation_date)
            VALUES (?, ?, ?, 0, 0, ?, ?, NOW())`,
            [userId, freeItemCode, totalFree, "Free Item", userId]
          );
        }
      } else {
        // Delete free item if quantity 0
        await conn.execute(
          `DELETE FROM xxafmc_cart_items
           WHERE user_id = ? AND item_id = ? AND price = 0`,
          [userId, freeItemCode]
        );
      }
    }

    await conn.commit();
    return { affectedRows: 1 };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const deleteCartItem = async (cartId, userId) => {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // Get item details before deleting
    const [item] = await conn.execute(
      `SELECT item_id, price FROM xxafmc_cart_items WHERE cart_id = ? AND user_id = ?`,
      [cartId, userId]
    );

    if (item.length === 0) {
      return { affectedRows: 0 };
    }

    const itemId = item[0].item_id;
    const price = item[0].price;

    // Delete the item
    const [result] = await conn.execute(
      `DELETE FROM xxafmc_cart_items WHERE cart_id = ? AND user_id = ?`,
      [cartId, userId]
    );

    // If it's a main item (price IS NULL), delete associated free item
    if (price === null) {
      const [offers] = await conn.execute(
        `SELECT FREE_ITEM_CODE FROM xxafmc_offers
         WHERE ITEM_CODE = ?
         AND (
           (END_DATE IS NULL AND CURDATE() >= DATE(OFFER_DATE))
           OR (CURDATE() BETWEEN DATE(OFFER_DATE) AND END_DATE)
         )
         LIMIT 1`,
        [itemId]
      );

      if (offers.length > 0) {
        const freeItemCode = offers[0].FREE_ITEM_CODE;
        await conn.execute(
          `DELETE FROM xxafmc_cart_items
           WHERE user_id = ? AND item_id = ? AND price = 0`,
          [userId, freeItemCode]
        );
      }
    }

    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

module.exports = {
  addCartItem,
  getCartItemsByUser,
  updateCartItemQuantity,
  deleteCartItem,
};


