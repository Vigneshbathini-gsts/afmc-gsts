const db = require("../config/db");
const cartModel = require("../models/cartModel");
const cocktailModel = require("../models/cocktailModel");

const getSessionUserKey = (req) =>
  String(req.user?.username || req.user?.user_name || req.user?.userId || "").trim() || "unknown";

const getCocktailSessionKey = (req, parentItemCode, orderNumber = "") =>
  `cocktailCollection_${String(orderNumber || "").trim()}_${String(parentItemCode || "").trim()}_${getSessionUserKey(req)}`;

const getCustomItemDetailsSessionKey = (req, itemId) =>
  `customItemDetails_${String(itemId || "").trim()}_${getSessionUserKey(req)}`;

const saveSession = (req) =>
  new Promise((resolve, reject) => {
    if (!req.session?.save) return resolve();
    req.session.save((err) => (err ? reject(err) : resolve()));
  });

const clearCocktailSessionCollections = async (req, parentItemCode = null, orderNumber = null) => {
  if (!req.session) return;

  const sessionKeyPrefix = "cocktailCollection_";
  const userKey = getSessionUserKey(req);
  let removedAny = false;

  for (const key of Object.keys(req.session)) {
    if (!key.startsWith(sessionKeyPrefix)) continue;

    const parts = key.split("_");
    const keyOrderNumber = parts[1] || "";
    const keyParentItemCode = parts[2] || "";
    const keyUserKey = parts.slice(3).join("_");

    if (keyUserKey !== userKey) continue;
    if (parentItemCode != null && String(keyParentItemCode) !== String(parentItemCode)) continue;
    if (orderNumber != null && String(keyOrderNumber) !== String(orderNumber)) continue;

    delete req.session[key];
    removedAny = true;
  }

  if (removedAny) {
    await saveSession(req);
  }
};

const getStockQuantities = async (conn, itemCodes) => {
  if (!Array.isArray(itemCodes) || itemCodes.length === 0) {
    return {};
  }

  const placeholders = itemCodes.map(() => "?").join(",");
  const [rows] = await conn.execute(
    `
    SELECT item_code, IFNULL(SUM(stock_quantity), 0) AS stock_quantity
    FROM xxafmc_stock_out
    WHERE item_code IN (${placeholders})
    GROUP BY item_code
    `,
    itemCodes
  );

  return rows.reduce((acc, row) => {
    acc[String(row.item_code)] = Number(row.stock_quantity || 0);
    return acc;
  }, {});
};

const normalizeCocktailIngredientRow = (row, loginType, cartItemQuantity = 1, overrideQuantity = null) => {
  const itemCode = Number(row.ITEM_CODE || 0);
  const itemName = String(row.ITEM_NAME || "").trim();
  const basePegs = Number(row.PEGS || 0);
  const normalizedLoginType = String(loginType || "").trim().toUpperCase();
  const selectedPrice = normalizedLoginType === "NON MEMBER"
    ? Number(row.NON_MEMBER_PRICE ?? row.PRICE ?? 0)
    : Number(row.PRICE ?? row.NON_MEMBER_PRICE ?? 0);
  const quantity = overrideQuantity != null
    ? Number(overrideQuantity)
    : basePegs * Number(cartItemQuantity || 1);
  const unitPrice = basePegs > 0 ? selectedPrice / basePegs : selectedPrice;
  const lineTotal = Number((unitPrice * quantity).toFixed(2));

  return {
    itemCode,
    itemName,
    basePegs,
    quantity,
    price: Number(selectedPrice.toFixed(2)),
    unitPrice: Number(unitPrice.toFixed(2)),
    lineTotal,
    inventoryItemCode: row.INVENTORY_ITEM_CODE,
    isCocktailIngredient: true,
    requiredPegs: quantity,
    hideAddButton: false,
    stockQuantity: 0,
    stockStatus: "Unknown",
    parentItem: row.INVENTORY_ITEM_CODE,
  };
};

const buildCocktailCollection = async (req, parentItemCode, cartItemQuantity = 1, orderNumber = "") => {
  const loginType = String(req.user?.loginType || "").trim().toUpperCase();
  const detailRows = await cocktailModel.getCocktailDetailRows(parentItemCode);

  const collectionRows = detailRows.map((row) =>
    normalizeCocktailIngredientRow(row, loginType, cartItemQuantity)
  );

  const itemCodes = [...new Set(collectionRows.map((row) => row.itemCode).filter(Boolean))];
  const stockMap = await getStockQuantities(db, itemCodes);

  const ingredients = collectionRows.map((row) => {
    const stockQuantity = stockMap[String(row.itemCode)] || 0;
    const enoughStock = stockQuantity >= row.quantity;

    return {
      ...row,
      stockQuantity,
      stockStatus: enoughStock ? "In Stock" : "Out Of Stock",
      hideAddButton: enoughStock ? "N" : "Y",
    };
  });

  const totalPrice = Number(
    ingredients.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0).toFixed(2)
  );

  return {
    parentItemCode,
    cartItemQuantity,
    orderNumber: orderNumber || null,
    ingredients,
    totalPrice,
  };
};

const getCocktailSessionCollection = async (req, parentItemCode, cartItemQuantity = 1, orderNumber = "") => {
  const sessionKey = getCocktailSessionKey(req, parentItemCode, orderNumber);
  let collection = req.session?.[sessionKey];

  if (!collection || Number(collection.cartItemQuantity) !== Number(cartItemQuantity)) {
    collection = await buildCocktailCollection(req, parentItemCode, cartItemQuantity, orderNumber);
    req.session[sessionKey] = collection;
    await saveSession(req);
  }

  return { sessionKey, collection };
};

const applyCocktailIngredientUpdates = (collection, updates) => {
  const updatesByCode = (Array.isArray(updates) ? updates : []).reduce((acc, item) => {
    if (item && item.itemCode != null) {
      acc[String(item.itemCode)] = item;
    }
    return acc;
  }, {});

  const ingredients = collection.ingredients.map((row) => {
    const update = updatesByCode[String(row.itemCode)];
    const quantity = update?.quantity != null ? Number(update.quantity) : Number(row.quantity || 0);
    const unitPrice = Number(row.unitPrice || 0);
    const lineTotal = Number((unitPrice * quantity).toFixed(2));
    const stockQuantity = Number(row.stockQuantity || 0);
    const enoughStock = stockQuantity >= quantity;

    return {
      ...row,
      quantity,
      requiredPegs: quantity,
      lineTotal,
      stockStatus: enoughStock ? "In Stock" : "Out Of Stock",
      hideAddButton: enoughStock ? "N" : "Y",
    };
  });

  const totalPrice = Number(
    ingredients.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0).toFixed(2)
  );

  return {
    ...collection,
    ingredients,
    totalPrice,
  };
};

const getCartItemById = async (req, cartId) => {
  const userId = req.user?.userId;
  if (!userId || Number.isNaN(Number(cartId))) {
    return null;
  }

  return cartModel.getCartItemById(Number(cartId), userId);
};

const getCartItemByCode = async (req, itemCode) => {
  const userId = req.user?.userId;
  if (!userId || itemCode == null) {
    return null;
  }

  return cartModel.getCartItemByCode(userId, itemCode);
};

const isCocktailCartItem = (cartItem) => {
  return Boolean(
    cartItem && cartItem.category_id === 10 && [14, 15].includes(Number(cartItem.sub_category))
  );
};

const validateCocktailItemOrFail = (cartItem) => {
  if (!cartItem) {
    const error = new Error("Cart item not found");
    error.status = 404;
    throw error;
  }

  if (!isCocktailCartItem(cartItem)) {
    const error = new Error("Cart item is not a cocktail or mocktail");
    error.status = 400;
    throw error;
  }
};

const getCocktailCollectionResponse = async (req, cartItem, orderNumber = "") => {
  const { collection } = await getCocktailSessionCollection(
    req,
    cartItem.item_id,
    cartItem.quantity,
    orderNumber
  );

  return {
    parentItemCode: collection.parentItemCode,
    orderNumber: collection.orderNumber,
    quantity: collection.cartItemQuantity,
    totalPrice: collection.totalPrice,
    ingredients: collection.ingredients,
  };
};

const getCustomItemDetails = async (req, itemId) => {
  const sessionKey = getCustomItemDetailsSessionKey(req, itemId);
  return req.session?.[sessionKey] || null;
};

exports.getCustomItemDetails = async (req, res) => {
  try {
    const itemId = Number(req.params.itemId);
    if (!itemId || Number.isNaN(itemId)) {
      return res.status(400).json({ success: false, message: "Valid item ID is required" });
    }

    const customDetails = await getCustomItemDetails(req, itemId);
    return res.status(200).json({ success: true, data: customDetails });
  } catch (error) {
    console.error("Error fetching custom item details:", error);
    return res.status(500).json({ success: false, message: "Failed to load custom item details" });
  }
};

exports.saveCustomItemDetails = async (req, res) => {
  try {
    const itemId = Number(req.params.itemId);
    if (!itemId || Number.isNaN(itemId)) {
      return res.status(400).json({ success: false, message: "Valid item ID is required" });
    }

    const { details, quantities } = req.body;
    if (!Array.isArray(details)) {
      return res.status(400).json({ success: false, message: "Details must be an array" });
    }

    const sessionKey = getCustomItemDetailsSessionKey(req, itemId);
    req.session[sessionKey] = {
      details,
      quantities: quantities || {},
      savedAt: new Date().toISOString(),
    };
    await saveSession(req);

    return res.status(200).json({ success: true, data: req.session[sessionKey] });
  } catch (error) {
    console.error("Error saving custom item details:", error);
    return res.status(500).json({ success: false, message: "Failed to save custom item details" });
  }
};

exports.clearCustomItemDetails = async (req, res) => {
  try {
    const itemId = Number(req.params.itemId);
    if (!itemId || Number.isNaN(itemId)) {
      return res.status(400).json({ success: false, message: "Valid item ID is required" });
    }

    const sessionKey = getCustomItemDetailsSessionKey(req, itemId);
    if (req.session && req.session[sessionKey]) {
      delete req.session[sessionKey];
      await saveSession(req);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error clearing custom item details:", error);
    return res.status(500).json({ success: false, message: "Failed to clear custom item details" });
  }
};

exports.addCartItem = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { item_id, quantity, unit_price, remarks, ingredients } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }
    if (!item_id) {
      return res.status(400).json({ success: false, message: "Item ID is required" });
    }
    if (unit_price == null || Number.isNaN(Number(unit_price))) {
      return res.status(400).json({ success: false, message: "Unit price is required" });
    }

    const itemData = {
      item_id,
      quantity: Number(quantity) || 1,
      unit_price: Number(unit_price),
      remarks: remarks || "Din",
      loginType: req.user?.loginType,
      customIngredients: ingredients
    };

    const result = await cartModel.addCartItem(userId, itemData);

    return res.status(201).json({
      success: true,
      message: result.message || "Item added to cart",
      data: {
        cartId: result.insertId || null,
      },
    });
  } catch (error) {
    console.error("Error adding item to cart:", error);
    const status = error?.status || (error?.message?.includes("Out of stock") ? 400 : 500);
    const message = error?.message || "Failed to add item to cart";
    return res.status(status).json({ success: false, message });
  }
};

exports.getCocktailDetails = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { cartId } = req.params;

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }
    if (!cartId || Number.isNaN(Number(cartId))) {
      return res.status(400).json({ success: false, message: "Cart ID is required and must be a valid number" });
    }

    const cartItem = await cartModel.getCartItemById(Number(cartId), userId);
    validateCocktailItemOrFail(cartItem);

    let collection = await cartModel.getCartCustomization(Number(cartId), userId);
    if (collection.ingredients.length === 0) {
      const connection = await db.getConnection();
      try {
        await cartModel.ensureCustomizationTable(connection);
        await connection.beginTransaction();
        await cartModel.createDefaultCustomizationForCart(connection, {
          cartId: Number(cartId),
          parentItemCode: cartItem.item_id,
          cartQuantity: cartItem.quantity,
          loginType: req.user?.loginType,
        });
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
      collection = await cartModel.getCartCustomization(Number(cartId), userId);
    }

    return res.status(200).json({ success: true, data: collection });
  } catch (error) {
    console.error("Error fetching cocktail details:", error);
    const status = error.status || 500;
    return res.status(status).json({ success: false, message: error.message || "Failed to fetch cocktail details" });
  }
};

exports.updateCocktailIngredients = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { cartId } = req.params;
    const { ingredients } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }
    if (!cartId || Number.isNaN(Number(cartId))) {
      return res.status(400).json({ success: false, message: "Cart ID is required and must be a valid number" });
    }
    if (!Array.isArray(ingredients)) {
      return res.status(400).json({ success: false, message: "Ingredients must be an array" });
    }

    const updatedCollection = await cartModel.updateCartCustomization(Number(cartId), userId, ingredients);

    return res.status(200).json({ success: true, data: updatedCollection });
  } catch (error) {
    console.error("Error updating cocktail ingredients:", error);
    const status = error.status || 500;
    return res.status(status).json({ success: false, message: error.message || "Failed to update cocktail ingredients" });
  }
};

exports.getCartItems = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    const items = await cartModel.getCartItemsByUser(userId);
    return res.status(200).json({ success: true, data: items });
  } catch (error) {
    console.error("Error fetching cart items:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch cart items" });
  }
};

exports.confirmOrder = async (req, res) => {
  const userId = req.user?.userId;
  const { pubmed, memberId, kitchenType } = req.body || {};

  if (!userId) {
    return res.status(400).json({ success: false, message: "User ID is required" });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Fetch Cart Items and join with inventory to get names and categories
    const [cartRows] = await connection.execute(
      `SELECT c.*, xi.category_id, xi.sub_category, xi.item_name 
       FROM xxafmc_cart_items c 
       JOIN xxafmc_inventory xi ON c.item_id = xi.item_code 
       WHERE c.user_id = ?`,
      [userId]
    );

    if (cartRows.length === 0) {
      throw new Error("Cart is empty");
    }

    // Calculate Order Total
    const orderTotal = cartRows.reduce((sum, item) => sum + Number(item.total || 0), 0);

    // 1. Create Order Header
    const [headerResult] = await connection.execute(
      `INSERT INTO xxafmc_order_header 
        (user_id, order_date, member_id, pubmed, created_by, creation_date, order_total)
       VALUES (?, NOW(), ?, ?, ?, NOW(), ?)`,
      [userId, memberId || null, pubmed || null, req.user?.username || 'SYSTEM', orderTotal]
    );
    const orderNumber = headerResult.insertId;

    for (const cartItem of cartRows) {
      // 2. Validate Stock inside transaction (Production Check)
      const [stockRows] = await connection.execute(
        `SELECT IFNULL(SUM(STOCK_QUANTITY), 0) AS stock FROM xxafmc_stock_out WHERE item_code = ?`,
        [cartItem.item_id]
      );
      const available = Number(stockRows[0]?.stock || 0);
      
      // Note: We also check reserved quantities from other orders
      const [reservedRows] = await connection.execute(
        `SELECT IFNULL(SUM(quantity), 0) AS reserved FROM xxafmc_order_details 
         WHERE item_id = ? AND order_status IS NULL AND order_id != ?`,
        [cartItem.item_id, orderNumber]
      );
      const reserved = Number(reservedRows[0]?.reserved || 0);

      if (cartItem.quantity + reserved > available) {
        throw new Error(`Insufficient stock for ${cartItem.item_name}. Only ${available - reserved} left.`);
      }

      // 3. Insert into Order Details
       await connection.execute(
        `INSERT INTO xxafmc_order_details 
         (order_id, item_id, quantity, price, subtotal, description, created_by, creation_date, subcategory, total_quantity)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)`,
        [
          orderNumber,
          cartItem.item_id,
          cartItem.quantity,
          cartItem.price,
          cartItem.total,
          cartItem.description,
          userId,
          cartItem.sub_category,
          cartItem.quantity
        ]
      );

      // 3. Create Kitchen Notification
      const kType = kitchenType || (Number(cartItem.category_id) === 10 ? 'Bar' : 'Kitchen');
      await connection.execute(
        `INSERT INTO xxafmc_kitchen_notification
          (ordernumber, user_name, item_id, item_name, quantity, created_by, creation_date, msg_read, status, kitchen_type)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), 'N', 'Received', ?)`,
        [
          orderNumber,
          userId,
          cartItem.item_id,
          cartItem.item_name,
          cartItem.quantity,
          userId,
          kType
        ]
      );
    }

    // 4. Migrate Customizations from cart to order
    const [customizationRows] = await connection.execute(
      `SELECT cc.*, c.item_id AS parent_item_code, c.quantity AS cart_qty
       FROM xxafmc_cart_customization cc
       JOIN xxafmc_cart_items c ON cc.cart_id = c.cart_id
       WHERE c.user_id = ?`,
      [userId]
    );

    for (const row of customizationRows) {
      await connection.execute(
        `INSERT INTO xxafmc_custom_cocktails_mocktails_details
          (item_code, item_name, pegs, inventory_item_code, user_id, quantity, order_number, creation_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          row.ingredient_item_code,
          row.ingredient_name,
          row.quantity,
          row.parent_item_code,
          userId,
          row.cart_qty,
          orderNumber
        ]
      );
    }

    // 5. Clear Cart
    await connection.execute(
      `DELETE FROM xxafmc_cart_customization 
       WHERE cart_id IN (SELECT cart_id FROM xxafmc_cart_items WHERE user_id = ?)`, 
      [userId]
    );
    await connection.execute("DELETE FROM xxafmc_cart_items WHERE user_id = ?", [userId]);

    await connection.commit();
    await clearCocktailSessionCollections(req, null, orderNumber);

    return res.status(200).json({
      success: true,
      message: "Order confirmed successfully",
      data: { orderNumber },
    });
  } catch (error) {
    console.error("Error confirming order:", error);
    await connection.rollback();
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
};

exports.updateCartItemQuantity = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { cartId } = req.params;
    const { quantity } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }
    if (!cartId || Number.isNaN(Number(cartId))) {
      return res.status(400).json({ success: false, message: "Cart ID is required and must be a valid number" });
    }
    if (quantity == null || Number.isNaN(Number(quantity))) {
      return res.status(400).json({ success: false, message: "Quantity is required and must be a number" });
    }

    const cartItem = await getCartItemById(req, Number(cartId));
    if (!cartItem) {
      return res.status(404).json({ success: false, message: "Cart item not found" });
    }

    const result = await cartModel.updateCartItemQuantity(Number(cartId), userId, Number(quantity));
    if (result?.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Cart item not found" });
    }

    if (isCocktailCartItem(cartItem)) {
      await clearCocktailSessionCollections(req, cartItem.item_id);
    }

    // Return updated cart items to avoid full refresh
    const items = await cartModel.getCartItemsByUser(userId);
    return res.status(200).json({ success: true, message: "Quantity updated", data: items });
  } catch (error) {
    console.error("Error updating cart item quantity:", error);
    const status = error?.status || (error?.message?.includes("Out of stock") ? 400 : 500);
    const message = error?.message || "Failed to update cart quantity";
    return res.status(status).json({
      success: false,
      message,
    });
  }
};

exports.deleteCartItem = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { cartId } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }
    if (!cartId || Number.isNaN(Number(cartId))) {
      return res.status(400).json({ success: false, message: "Cart ID is required and must be a valid number" });
    }

    const cartItem = await getCartItemById(req, Number(cartId));

    const result = await cartModel.deleteCartItem(Number(cartId), userId);
    if (result?.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Cart item not found" });
    }

    if (cartItem && isCocktailCartItem(cartItem)) {
      await clearCocktailSessionCollections(req, cartItem.item_id);
    }

    // Return updated cart items
    const items = await cartModel.getCartItemsByUser(userId);
    return res.status(200).json({ success: true, message: "Cart item removed", data: items });
  } catch (error) {
    console.error("Error deleting cart item:", error);
    return res.status(500).json({ success: false, message: "Failed to remove cart item" });
  }
};




exports.getLovIngredients = async (req, res) => {
  try {
    const { subCategory } = req.query;

    if (!subCategory) {
      return res.status(400).json({
        success: false,
        message: "subCategory is required",
      });
    }

    const data = await cartModel.getLovIngredients(subCategory);

    return res.status(200).json({
      success: true,
      data,
    });

  } catch (error) {
    console.error("Controller Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch items",
      error: error.message,
    });
  }
};
