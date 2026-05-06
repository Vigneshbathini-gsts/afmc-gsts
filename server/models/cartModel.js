const db = require("../config/db");

const createValidationError = (message) => {
  const error = new Error(message);
  error.status = 400;
  return error;
};

const getStockQuantity = async (conn, itemCode) => {
  const [rows] = await conn.execute(
    `SELECT IFNULL(SUM(STOCK_QUANTITY), 0) AS stock
     FROM xxafmc_stock_out
     WHERE item_code = ?`,
    [itemCode]
  );

  return Number(rows[0]?.stock || 0);
};

const getOrderReservedQuantity = async (conn, itemCode) => {
  const [rows] = await conn.execute(
    `SELECT IFNULL(SUM(xod.quantity), 0) AS reserved
     FROM xxafmc_order_details xod
     LEFT JOIN xxafmc_order_header xoh ON xod.order_id = xoh.order_num
     LEFT JOIN xxafmc_invoices xi ON xi.order_num = xod.order_id
     WHERE xod.item_id = ?
       AND xod.order_status IS NULL
       AND xod.price IS NULL
       AND xi.order_num IS NULL`,
    [itemCode]
  );

  return Number(rows[0]?.reserved || 0);
};

const getCartQuantity = async (conn, userId, itemCode, priceZero = false, parentCode = null) => {
  const priceCondition = priceZero ? "= 0" : "!= 0";
  let query = `SELECT IFNULL(SUM(quantity), 0) AS qty
     FROM xxafmc_cart_items
     WHERE user_id = ?
       AND item_id = ?
       AND price ${priceCondition}`;
  const params = [userId, itemCode];

  if (parentCode !== null) {
    query += " AND parent_code = ?";
    params.push(parentCode);
  }

  const [rows] = await conn.execute(query, params);
  return Number(rows[0]?.qty || 0);
};

const addCartItem = async (userId, itemData) => {
  const { item_id, quantity = 1, unit_price = 0, remarks } = itemData;

  const conn = await db.getConnection();
  const [[itemInfo]] = await conn.execute(
    `SELECT category_id, sub_category, food_pr_charges
       FROM xxafmc_inventory
       WHERE item_code = ?`,
    [item_id]
  );

  if (!itemInfo) throw new Error("Item not found");

  const { category_id, sub_category, food_pr_charges } = itemInfo;
  const isCocktailOrMocktail = category_id === 10 && [14, 15].includes(sub_category);

  try {
    await conn.beginTransaction();

    // -------------------------------
    // 1. VALIDATE MAIN ITEM STOCK
    // -------------------------------
    const orderReservedQty = await getOrderReservedQuantity(conn, item_id);
    const existingCartQty = await getCartQuantity(conn, userId, item_id, false);

    let stockQty;
    if (!isCocktailOrMocktail) {
      stockQty = await getStockQuantity(conn, item_id);
    }




    if (!isCocktailOrMocktail && existingCartQty + quantity + orderReservedQty > stockQty) {
      const availableQty = Math.max(0, stockQty - orderReservedQty - existingCartQty);
      throw createValidationError(`Out of stock. Available quantity: ${availableQty}`);
    }

    // -------------------------------
    // 2. CHECK EXISTING CART ITEM
    // -------------------------------
    const [existing] = await conn.execute(
      `SELECT cart_id, quantity FROM xxafmc_cart_items 
       WHERE user_id = ? AND item_id = ? AND price != 0`,
      [userId, item_id]
    );

    let newQty = quantity;
    let insertId = null;

    if (existing.length > 0) {
      newQty = existing[0].quantity + quantity;

      await conn.execute(
        `UPDATE xxafmc_cart_items
         SET quantity = ?, total = price * ?
         WHERE cart_id = ?`,
        [newQty, newQty, existing[0].cart_id]
      );
    } else {
      const [insertResult] = await conn.execute(
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
      insertId = insertResult.insertId;






























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
      return { message: "Item added (no offer)", insertId, isCocktailItem: isCocktailOrMocktail };
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
      return { message: "Item added (offer not applicable yet)", insertId, isCocktailItem: isCocktailOrMocktail };
    }

    // -------------------------------
    // 4. CALCULATE FREE ITEMS
    // -------------------------------
    const totalFree = Math.floor(newQty / offerQty) * freeItemQty;

    // -------------------------------
    // 5. VALIDATE FREE ITEM STOCK
    // -------------------------------
    const freeStockQty = await getStockQuantity(conn, freeItemCode);
    const freeReservedQty = await getOrderReservedQuantity(conn, freeItemCode);
    const existingFreeQtyGlobal = await getCartQuantity(conn, userId, freeItemCode, true);
    const existingFreeQtyForParent = await getCartQuantity(conn, userId, freeItemCode, true, item_id);
    const futureFreeQty = existingFreeQtyGlobal - existingFreeQtyForParent + totalFree;

    if (futureFreeQty + freeReservedQty > freeStockQty) {
      const availableFreeQty = Math.max(0, freeStockQty - freeReservedQty - (existingFreeQtyGlobal - existingFreeQtyForParent));
      throw new Error(`Available stock for free item : ${availableFreeQty}`);
    }

    // -------------------------------
    // 6. INSERT / UPDATE FREE ITEM
    // -------------------------------
    const [freeExisting] = await conn.execute(
      `SELECT cart_id FROM xxafmc_cart_items
       WHERE user_id = ? AND item_id = ? AND price = 0 AND parent_code = ?`,



      [userId, freeItemCode, item_id]
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
        (user_id, item_id, quantity, price, total, description, created_by, creation_date, parent_code)
        VALUES (?, ?, ?, 0, 0, ?, ?, NOW(), ?)`,
        [
          userId,
          freeItemCode,
          totalFree,
          "Free Item",
          userId,
          item_id,
        ]
      );
    }

    await conn.commit();

    return {
      message: "Item + free item added successfully",
      insertId,
      isCocktailItem: isCocktailOrMocktail,
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
      xi.sub_category AS inventory_subcategory,  -- ✅ FIX
      COALESCE(
        (SELECT SUM(stock_quantity)
         FROM xxafmc_stock_out
         WHERE item_code = xi.item_code),
        0
      ) AS stock_quantity
    FROM xxafmc_cart_items c
    INNER JOIN xxafmc_inventory xi 
      ON c.item_id = xi.item_code
    WHERE c.user_id = ?
    ORDER BY c.creation_date DESC
  `;

  const [rows] = await db.execute(sql, [userId]);

  return rows.map((row) => {
    const quantity = Number(row.quantity || 0);

    const rawPrice = row.price ?? row.inventory_price;
    const price = Number(rawPrice || 0);
    const subcategory = Number(row.inventory_subcategory || 0);
    const isFreeItem = price === 0;

    const isCocktailItem = [14, 15].includes(subcategory);

    const canEdit = isCocktailItem && !isFreeItem;

    const stockQty = Number(row.stock_quantity || 0);
    const stockStatus = stockQty === 0 ? "Out Of Stock" : "In Stock";


    return {
      cartId: Number(row.cart_id),
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
      subcategory,
      stockQuantity: stockQty,
      stockStatus,
      isFreeItem,
      canEdit,
    };
  });
};

const updateCartItemQuantity = async (cartId, userId, quantity) => {
  const conn = await db.getConnection();

  if (Number.isNaN(cartId)) {
    throw new Error("Invalid cart ID");
  }

  try {
    await conn.beginTransaction();

    if (quantity <= 0) {
      return await deleteCartItem(cartId, userId);
    }

    // Get current item details
    const [current] = await conn.execute(
      `SELECT c.item_id, c.quantity, xi.category_id, xi.sub_category
       FROM xxafmc_cart_items c
       LEFT JOIN xxafmc_inventory xi ON c.item_id = xi.item_code
       WHERE c.cart_id = ? AND c.user_id = ?`,
      [cartId, userId]
    );

    if (current.length === 0) {
      return { affectedRows: 0 };
    }

    const itemId = current[0].item_id;
    const oldQty = current[0].quantity;
    const isCocktailOrMocktail = current[0].category_id === 10 && [14, 15].includes(current[0].sub_category);

    // -------------------------------
    // 2. VALIDATE MAIN ITEM STOCK ON QUANTITY CHANGE
    // -------------------------------
    if (!isCocktailOrMocktail) {
      const stockQty = await getStockQuantity(conn, itemId);
      const orderReservedQty = await getOrderReservedQuantity(conn, itemId);

      if (quantity + orderReservedQty > stockQty) {
        const availableQty = Math.max(0, stockQty - orderReservedQty);
        throw new Error(`Available stock is : ${availableQty}`);
      }
    }

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

      // -------------------------------
      // VALIDATE FREE ITEM STOCK ON QUANTITY CHANGE
      // -------------------------------
      const freeStockQty = await getStockQuantity(conn, freeItemCode);
      const freeReservedQty = await getOrderReservedQuantity(conn, freeItemCode);
      const existingFreeQtyGlobal = await getCartQuantity(conn, userId, freeItemCode, true);
      const existingFreeQtyForParent = await getCartQuantity(conn, userId, freeItemCode, true, itemId);
      const futureFreeQty = existingFreeQtyGlobal - existingFreeQtyForParent + totalFree;

      if (futureFreeQty + freeReservedQty > freeStockQty) {
        const availableFreeQty = Math.max(0, freeStockQty - freeReservedQty - (existingFreeQtyGlobal - existingFreeQtyForParent));
        throw createValidationError(`Out of stock for free item. Available quantity: ${availableFreeQty}`);
      }

      // Update or delete free item
      if (totalFree > 0) {
        const [freeExisting] = await conn.execute(
          `SELECT cart_id FROM xxafmc_cart_items
           WHERE user_id = ? AND item_id = ? AND price = 0 AND parent_code = ?`,
          [userId, freeItemCode, itemId]
        );

        if (freeExisting.length > 0) {
          await conn.execute(
            `UPDATE xxafmc_cart_items SET quantity = ? WHERE cart_id = ?`,
            [totalFree, freeExisting[0].cart_id]
          );
        } else {
          await conn.execute(
            `INSERT INTO xxafmc_cart_items
            (user_id, item_id, quantity, price, total, description, created_by, creation_date, parent_code)
            VALUES (?, ?, ?, 0, 0, ?, ?, NOW(), ?)`,
            [userId, freeItemCode, totalFree, "Free Item", userId, itemId]
          );
        }
      } else {
        // Delete free item if quantity 0 for this parent item only
        await conn.execute(
          `DELETE FROM xxafmc_cart_items
           WHERE user_id = ? AND item_id = ? AND price = 0 AND parent_code = ?`,
          [userId, freeItemCode, itemId]
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

  if (Number.isNaN(cartId)) {
    throw new Error("Invalid cart ID");
  }

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

    // If it's a main item (price != 0), delete associated free item
    if (price !== 0) {
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
           WHERE user_id = ? AND parent_code = ? AND price = 0`,
          [userId, itemId]
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

const getCartItemById = async (cartId, userId) => {
  const [rows] = await db.execute(
    `SELECT c.cart_id, c.item_id, c.quantity, xi.category_id, xi.sub_category
     FROM xxafmc_cart_items c
     LEFT JOIN xxafmc_inventory xi ON c.item_id = xi.item_code
     WHERE c.cart_id = ?
       AND c.user_id = ?
       AND c.price != 0
     LIMIT 1`,
    [cartId, userId]
  );

  return rows[0] || null;
};

const getCartItemByCode = async (userId, itemCode) => {
  const [rows] = await db.execute(
    `SELECT c.cart_id, c.item_id, c.quantity, xi.category_id, xi.sub_category
     FROM xxafmc_cart_items c
     LEFT JOIN xxafmc_inventory xi ON c.item_id = xi.item_code
     WHERE c.user_id = ?
       AND c.item_id = ?
       AND c.price != 0
     LIMIT 1`,
    [userId, itemCode]
  );

  return rows[0] || null;
};





const getLovIngredients = async (subCategory) => {
  let connection;
  try {
    connection = await db.getConnection();

    const query = `
      SELECT xi.item_name AS d,
             xi.item_code AS r
      FROM xxafmc_inventory xi
      WHERE EXISTS (
          SELECT 1
          FROM xxafmc_stock_out xso
          WHERE xso.item_code = xi.item_code
            AND xso.stock_quantity > 0
      )
      AND (
        (? = 14 AND xi.sub_category IN (9, 6, 4, 18))
        OR
        (? = 15 AND xi.sub_category IN (2, 5, 6, 11, 12, 13, 10, 17, 16, 18))
      )
      AND xi.\`A/C_UNIT\` <> 'Glass'
    `;

    const [rows] = await connection.query(query, [subCategory, subCategory]);

    return rows;

  } catch (error) {
    console.error("Model Error:", error);
    throw error;
  } finally {
    if (connection) connection.release();
  }
};

module.exports = {
  addCartItem,
  getCartItemsByUser,
  updateCartItemQuantity,
  deleteCartItem,
  getCartItemById,
  getCartItemByCode,
  getLovIngredients,
};


