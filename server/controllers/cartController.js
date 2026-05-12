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

const getNextOrderLineId = async (connection) => {
  const [[row]] = await connection.execute(
    `
      SELECT COALESCE(MAX(order_line_id), 0) + 1 AS nextId
      FROM xxafmc_order_details
    `
  );
  return Number(row?.nextId || 1);
};

const getMCollectionFromSession = async (req, cartItems, orderNumber = "") => {
  const rows = [];
  for (const cartItem of cartItems) {
    if (!isCocktailCartItem(cartItem)) continue;
    const { collection } = await getCocktailSessionCollection(req, cartItem.item_id, cartItem.quantity, orderNumber);
    for (const ingredient of collection.ingredients || []) {
      rows.push({
        item_code: ingredient.itemCode,
        item_name: ingredient.itemName,
        pegs: ingredient.basePegs,
        inventory_item_code: cartItem.item_id,
        user_id: req.user?.userId,
        stock_quantity: ingredient.stockQuantity,
      });
    }
  }
  return rows;
};

const validateCartQuantitiesOrThrow = (cartRows) => {
  const hasZero = (cartRows || []).some((row) => Number(row.quantity || 0) <= 0);
  if (hasZero) {
    const error = new Error("Some items have a quantity of 0. Please update the quantity before proceeding.");
    error.status = 400;
    throw error;
  }
};

const validateCocktailChildStockOrThrow = async (connection, req, cartRows, orderNumber = "") => {
  // Equivalent to the APEX validation that checks child item stock only when no M_COLLECTION exists.
  const mCollectionRows = await getMCollectionFromSession(req, cartRows, orderNumber);
  if (mCollectionRows.length > 0) return;

  const cocktailCartIds = (cartRows || [])
    .filter((row) => isCocktailCartItem(row))
    .map((row) => Number(row.cart_id))
    .filter((id) => Number.isFinite(id) && id > 0);
  if (cocktailCartIds.length === 0) return;

  // Prefer validating against the cart's actual customization (xxafmc_cart_customization),
  // since users may change ingredients/pegs after adding the cocktail.
  const uniqueCartIds = [...new Set(cocktailCartIds)];
  const placeholders = uniqueCartIds.map(() => "?").join(",");
  const [customRows] = await connection.execute(
    `
      SELECT
        cc.cart_id,
        cc.ingredient_item_code,
        cc.ingredient_name,
        cc.quantity AS ingredient_quantity,
        c.quantity AS cart_quantity
      FROM xxafmc_cart_customization cc
      INNER JOIN xxafmc_cart_items c
        ON c.cart_id = cc.cart_id
      WHERE cc.cart_id IN (${placeholders})
    `,
    uniqueCartIds
  );

  if (customRows.length > 0) {
    const ingredientCodes = [...new Set(customRows
      .map((row) => Number(row.ingredient_item_code))
      .filter((code) => Number.isFinite(code) && code > 0))];

    const stockPlaceholders = ingredientCodes.map(() => "?").join(",");
    const [stockRows] = await connection.execute(
      `
        SELECT item_code, IFNULL(stock_quantity, 0) AS stock_quantity
        FROM xxafmc_inventory
        WHERE item_code IN (${stockPlaceholders})
      `,
      ingredientCodes
    );
    const inventoryStockMap = stockRows.reduce((acc, row) => {
      acc[String(row.item_code)] = Number(row.stock_quantity || 0);
      return acc;
    }, {});

    const [stockOutRows] = await connection.execute(
      `
        SELECT item_code, IFNULL(SUM(stock_quantity), 0) AS stock_quantity
        FROM xxafmc_stock_out
        WHERE item_code IN (${stockPlaceholders})
        GROUP BY item_code
      `,
      ingredientCodes
    );
    const stockOutMap = stockOutRows.reduce((acc, row) => {
      acc[String(row.item_code)] = Number(row.stock_quantity || 0);
      return acc;
    }, {});

    const stockMap = ingredientCodes.reduce((acc, code) => {
      const key = String(code);
      acc[key] = Math.max(Number(inventoryStockMap[key] || 0), Number(stockOutMap[key] || 0));
      return acc;
    }, {});

    const [reservedRows] = await connection.execute(
      `
        SELECT xod.item_id AS item_code, IFNULL(SUM(xod.quantity), 0) AS reserved
        FROM xxafmc_order_details xod
        LEFT JOIN xxafmc_order_header xoh ON xod.order_id = xoh.order_num
        LEFT JOIN xxafmc_invoices xi ON xi.order_num = xod.order_id
        WHERE xod.item_id IN (${stockPlaceholders})
          AND xod.order_status IS NULL
          AND xod.price IS NULL
          AND xi.order_num IS NULL
        GROUP BY xod.item_id
      `,
      ingredientCodes
    );
    const reservedMap = reservedRows.reduce((acc, row) => {
      acc[String(row.item_code)] = Number(row.reserved || 0);
      return acc;
    }, {});

    const byCart = customRows.reduce((acc, row) => {
      const cartId = Number(row.cart_id);
      if (!acc.has(cartId)) acc.set(cartId, []);
      acc.get(cartId).push({
        itemCode: Number(row.ingredient_item_code),
        itemName: String(row.ingredient_name || "").trim(),
        ingredientQuantity: Number(row.ingredient_quantity || 0),
        cartQuantity: Number(row.cart_quantity || 1),
      });
      return acc;
    }, new Map());

    for (const [cartId, ingredients] of byCart.entries()) {
      for (const ingredient of ingredients) {
        const stockQuantity = Number(stockMap[String(ingredient.itemCode)] || 0);
        const reservedQuantity = Number(reservedMap[String(ingredient.itemCode)] || 0);
        const availableQuantity = Math.max(0, stockQuantity - reservedQuantity);
        const requiredQuantity = Number(ingredient.ingredientQuantity || 0) * Number(ingredient.cartQuantity || 1);
        if (availableQuantity < requiredQuantity) {
          const error = new Error(`Out of stock for ingredient ${ingredient.itemName || ingredient.itemCode}. Available quantity: ${availableQuantity}`);
          error.status = 400;
          throw error;
        }
      }
    }

    return;
  }

  // Fallback to legacy validation for cocktails without customization rows.
  const cocktailParentIds = (cartRows || [])
    .filter((row) => isCocktailCartItem(row))
    .map((row) => Number(row.item_id))
    .filter(Boolean);
  if (cocktailParentIds.length === 0) return;

  const detailPlaceholders = cocktailParentIds.map(() => "?").join(",");
  const [rows] = await connection.execute(
    `
      SELECT
        xcmd.item_code AS child_item_code,
        COALESCE(SUM(xso.stock_quantity), 0) AS stock_quantity
      FROM xxafmc_cocktails_mocktails_details xcmd
      LEFT JOIN xxafmc_stock_out xso ON xso.item_code = xcmd.item_code
      WHERE xcmd.inventory_item_code IN (${detailPlaceholders})
      GROUP BY xcmd.item_code
    `,
    cocktailParentIds
  );

  const hasOutOfStock = rows.some((row) => Number(row.stock_quantity || 0) === 0);
  if (hasOutOfStock) {
    const error = new Error("One of the Child item has no stock.");
    error.status = 400;
    throw error;
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
    const { item_id, quantity, unit_price, remarks, orderNumber } = req.body;

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
  const { orderNumber } = req.body || {};

  if (!userId) {
    return res.status(400).json({ success: false, message: "User ID is required" });
  }
  if (!orderNumber || typeof orderNumber !== "string") {
    return res.status(400).json({ success: false, message: "Order number is required" });
  }

  const connection = await db.getConnection();
  try {
    await cartModel.ensureCustomizationTable(connection);
    await connection.beginTransaction();

    const [cartRows] = await connection.execute(
      "SELECT cart_id, item_id, quantity FROM xxafmc_cart_items WHERE user_id = ?",
      [userId]
    );

    const cartQuantityMap = new Map(
      cartRows.map((row) => [String(row.item_id), Number(row.quantity || 0)])
    );

    const collectionRows = await getMCollectionFromSession(req, cartRows, orderNumber);

    let mainInserted = 0;
    let customizationInserted = 0;
    for (const row of collectionRows) {
      const inventoryItemCode = String(row.inventory_item_code);
      if (customizedParentItemCodes.has(inventoryItemCode)) continue;
      const quantity = cartQuantityMap.get(inventoryItemCode);
      if (!quantity) continue;

      const requiredQuantity = Number(row.pegs || 0) * Number(quantity);
      if (Number(row.stock_quantity || 0) < requiredQuantity) continue;

      const [existingRows] = await connection.execute(
        `SELECT 1 FROM xxafmc_custom_cocktails_mocktails_details WHERE inventory_item_code = ? AND order_number = ? LIMIT 1`,
        [row.inventory_item_code, orderNumber]
      );
      if (existingRows.length > 0) continue;

      await connection.execute(
        `INSERT INTO xxafmc_custom_cocktails_mocktails_details
          (item_code, item_name, pegs, inventory_item_code, user_id, quantity, order_number, creation_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [row.item_code, row.item_name, row.pegs, row.inventory_item_code, row.user_id, quantity, orderNumber]
      );
      mainInserted += 1;
    }

    const [cocktailRows] = await connection.execute(
      `SELECT
          xcmd.inventory_item_code,
          xcmd.pegs,
          xcmd.item_name,
          xcmd.item_code
        FROM xxafmc_cocktails_mocktails_details xcmd
        JOIN xxafmc_cart_items xc ON xc.item_id = xcmd.inventory_item_code AND xc.user_id = ?
        GROUP BY xcmd.inventory_item_code, xcmd.pegs, xcmd.item_name, xcmd.item_code`,
      [userId]
    );

    const mCollectionInventorySet = new Set(
      collectionRows.map((row) => String(row.inventory_item_code))
    );

    let dummyInserted = 0;
    for (const row of cocktailRows) {
      const inventoryItemCode = String(row.inventory_item_code);
      if (mCollectionInventorySet.has(inventoryItemCode)) continue;
      const quantity = cartQuantityMap.get(inventoryItemCode);
      if (!quantity) continue;

      const [stockRows] = await connection.execute(
        `SELECT COALESCE(SUM(stock_quantity), 0) AS total_stock FROM xxafmc_stock_out WHERE item_code = ?`,
        [row.item_code]
      );
      const totalStock = Number(stockRows[0]?.total_stock || 0);
      const requiredQuantity = Number(row.pegs || 0) * Number(quantity);
      if (totalStock < requiredQuantity) continue;

      const [existingRows] = await connection.execute(
        `SELECT 1 FROM xxafmc_custom_cocktails_mocktails_details_dummy WHERE inventory_item_code = ? AND order_number = ? LIMIT 1`,
        [row.inventory_item_code, orderNumber]
      );
      if (existingRows.length > 0) continue;

      await connection.execute(
        `INSERT INTO xxafmc_custom_cocktails_mocktails_details_dummy
          (item_code, item_name, pegs, inventory_item_code, user_id, quantity, order_number, creation_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [row.item_code, row.item_name, row.pegs, row.inventory_item_code, userId, quantity, orderNumber]
      );
      dummyInserted += 1;
    }

    await connection.commit();

    await clearCocktailSessionCollections(req, null, orderNumber);

    return res.status(200).json({
      success: true,
      message: "Order confirmed successfully",
      data: { orderNumber, mainInserted, dummyInserted, customizationInserted },
    });
  } catch (error) {
    console.error("Error confirming order:", error);
    await connection.rollback();
    const status = error?.status || 500;
    return res.status(status).json({
      success: false,
      message: error?.message || "Failed to confirm order",
    });
  } finally {
    connection.release();
  }
};

exports.proceedToBuy = async (req, res) => {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(400).json({ success: false, message: "User ID is required" });
  }

  const { memberId = null, pubmed = null } = req.body || {};
  const appUser = String(req.user?.username || req.user?.user_name || userId);

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [cartRows] = await connection.execute(
      `SELECT
         c.cart_id,
         c.item_id,
         c.quantity,
         c.total,
         c.price,
         c.profit,
         c.food_pr_charges,
         c.type_id,
         COALESCE(xi.sub_category, c.subcategory) AS subcategory,
         xi.category_id AS category_id,
         c.parent_code,
         c.type
       FROM xxafmc_cart_items c
       LEFT JOIN xxafmc_inventory xi
         ON xi.item_code = c.item_id
       WHERE c.user_id = ?`,
      [userId]
    );

    if (!cartRows.length) {
      const error = new Error("Cart is empty");
      error.status = 400;
      throw error;
    }

    validateCartQuantitiesOrThrow(cartRows);
    await validateCocktailChildStockOrThrow(connection, req, cartRows, "");

    const [headerResult] = await connection.execute(
      `
        INSERT INTO xxafmc_order_header
          (user_id, order_date, member_id, pubmed, created_by, creation_date)
        VALUES
          (?, NOW(), ?, ?, ?, NOW())
      `,
      [userId, memberId, pubmed, appUser]
    );
    const orderNumber = String(headerResult.insertId);

    for (const item of cartRows) {
      const isCocktailOrMocktail = [14, 15].includes(Number(item.subcategory));
      let availableStock = 0;
      let itemName = "";
      const safeQuantity = Number(item.quantity || 0);
      const safePrice = Number.isFinite(Number(item.price)) ? Number(item.price) : 0;
      const safeTotal = Number.isFinite(Number(item.total)) ? Number(item.total) : Number((safePrice * safeQuantity).toFixed(2));
      const safeProfit = Number.isFinite(Number(item.profit)) ? Number(item.profit) : 0;
      const safeFoodCharges = Number.isFinite(Number(item.food_pr_charges)) ? Number(item.food_pr_charges) : 0;

      if (isCocktailOrMocktail) {
        // Cocktail/mocktail parent items do not have direct stock; their availability is driven by ingredient stock.
        // Ingredient stock is validated in validateCocktailChildStockOrThrow above.
        availableStock = Number.POSITIVE_INFINITY;
      } else {
      // Prefer inventory stock_quantity (used by inventory transactions), fall back to stock_out buckets.
      try {
        const [invRows] = await connection.execute(
          `SELECT item_name, IFNULL(stock_quantity, 0) AS stock_quantity FROM xxafmc_inventory WHERE item_code = ? LIMIT 1`,
          [item.item_id]
        );
        itemName = String(invRows[0]?.item_name || "").trim();
        availableStock = Number(invRows[0]?.stock_quantity || 0);
      } catch {
        availableStock = 0;
      }

      if (availableStock <= 0) {
        try {
          const [stockRows] = await connection.execute(
            `
              SELECT item_name, COALESCE(SUM(stock_quantity), 0) AS stock_quantity
              FROM xxafmc_stock_out
              WHERE item_code = ?
              GROUP BY item_code, item_name
            `,
            [item.item_id]
          );
          itemName = itemName || String(stockRows[0]?.item_name || "").trim();
          availableStock = Math.max(availableStock, Number(stockRows[0]?.stock_quantity || 0));
        } catch {
          // ignore
        }
      }

      // Deduct reserved quantities (pending/unbilled) to match cart/add validations.
      try {
        const [reservedRows] = await connection.execute(
          `
            SELECT IFNULL(SUM(xod.quantity), 0) AS reserved
            FROM xxafmc_order_details xod
            LEFT JOIN xxafmc_order_header xoh ON xod.order_id = xoh.order_num
            LEFT JOIN xxafmc_invoices xi ON xi.order_num = xod.order_id
            WHERE xod.item_id = ?
              AND xod.order_status IS NULL
              AND xod.price IS NULL
              AND xi.order_num IS NULL
          `,
          [item.item_id]
        );
        const reservedQty = Number(reservedRows[0]?.reserved || 0);
        availableStock = Math.max(0, availableStock - reservedQty);
      } catch {
        // ignore reserved lookup failures
      }

      if (!itemName) {
        try {
          const [invRows] = await connection.execute(
            `SELECT item_name FROM xxafmc_inventory WHERE item_code = ? LIMIT 1`,
            [item.item_id]
          );
          itemName = String(invRows[0]?.item_name || "").trim();
        } catch {
          // ignore
        }
      }
      }

      const stockInCart = safeQuantity;
      if (stockInCart > availableStock) {
        const error = new Error(`Out of Stock for item ${itemName || item.item_id}. Available quantity: ${availableStock}`);
        error.status = 400;
        throw error;
      }

      const orderLineId = await getNextOrderLineId(connection);
      await connection.execute(
        `
          INSERT INTO xxafmc_order_details
            (
              order_line_id,
              order_id,
              item_id,
              quantity,
              subtotal,
              price,
              total_quantity,
              profit,
              food_pr_charges,
              created_by,
              creation_date,
              type_id,
              subcategory,
              barcode,
              type
            )
          VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?)
        `,
        [
          orderLineId,
          orderNumber,
          item.item_id,
          safeQuantity,
          safeTotal,
          safePrice,
          safeQuantity,
          safeProfit,
          safeFoodCharges,
          appUser,
          item.type_id,
          item.subcategory,
          item.parent_code,
          item.type,
        ]
      );
    }

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: "Order created",
      data: { orderNumber },
    });
  } catch (error) {
    console.error("Error proceeding to buy:", error);
    await connection.rollback();
    const status = error?.status || 500;
    return res.status(status).json({ success: false, message: error?.message || "Failed to create order" });
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
