const db = require("../../config/db");
const cartModel = require("./cartModel");
const cocktailModel = require("../../models/cocktailModel");
const { usesNonMemberPricing } = require("../../helpers/customerPricing");
const { isExcludedLiquorSubcategory } = require("../../helpers/pricingHelper");

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

const normalizeCocktailIngredientRow = (
  row,
  loginType,
  cartItemQuantity = 1,
  overrideQuantity = null,
  roleId = null
) => {
  const itemCode = Number(row.ITEM_CODE || 0);
  const itemName = String(row.ITEM_NAME || "").trim();
  const basePegs = Number(row.PEGS || 0);
  const isNonMember = usesNonMemberPricing({ roleId, loginType });
  const selectedPrice = isNonMember
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
  const loginType = req.user?.loginType;
  const roleId = req.user?.roleId;
  const detailRows = await cocktailModel.getCocktailDetailRows(parentItemCode);

  const collectionRows = detailRows.map((row) =>
    normalizeCocktailIngredientRow(row, loginType, cartItemQuantity, null, roleId)
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
  // console.log(userId)
  if (!userId || itemCode == null) {
    return null;
  }

  return cartModel.getCartItemByCode(userId, itemCode);
};

const isCocktailCartItem = (cartItem) => {
  return Boolean(
    cartItem &&
    ((cartItem.category_id === 10 && [14, 15].includes(Number(cartItem.sub_category))) ||
      Number(cartItem.has_recipe || 0) > 0)
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
    const { item_id, quantity, unit_price, remarks, type, ingredients, orderNumber } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }
    if (!item_id) {
      return res.status(400).json({ success: false, message: "Item ID is required" });
    }
    if (unit_price == null || Number.isNaN(Number(unit_price))) {
      return res.status(400).json({ success: false, message: "Unit price is required" });
    }
    const normalizedQuantity = Number(quantity);
    if (!Number.isInteger(normalizedQuantity) || normalizedQuantity < 1) {
      return res.status(400).json({ success: false, message: "Quantity must be at least 1" });
    }

    const itemData = {
      item_id,
      quantity: normalizedQuantity,
      unit_price: Number(unit_price),
      remarks: remarks || "Din",
      type: typeof type === "string" ? type.trim() : type,
      loginType: req.user?.loginType,
      roleId: req.user?.roleId,
      customIngredients: ingredients,
      orderNumber,
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
// console.log("cartID",cartId)
    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }
    if (!cartId || Number.isNaN(Number(cartId))) {
      return res.status(400).json({ success: false, message: "Cart ID is required and must be a valid number" });
    }

    const cartItem = await cartModel.getCartItemById(Number(cartId), userId);
    validateCocktailItemOrFail(cartItem);
// console.log("cartItem",cartItem)
    const collection = await cartModel.getCartCustomization(Number(cartId), userId);
    // console.log("collection",collection)

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

exports.proceedToBuy = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    const items = await cartModel.getCartItemsByUser(userId);
    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    // `client/src/pages/common/CartBuy.jsx` currently routes into the Pub menu flow and
    // does not persist/consume this orderNumber. It only needs a stable token to navigate.
    const orderNumber = Date.now();

    return res.status(200).json({
      success: true,
      message: "Proceed to buy initialized",
      data: { orderNumber },
    });
  } catch (error) {
    console.error("Error in proceedToBuy:", error);
    return res.status(500).json({ success: false, message: "Failed to proceed to buy" });
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

    const lockInventoryItem = async (itemCode) => {
      const normalized = Number(itemCode);
      if (!Number.isFinite(normalized) || normalized <= 0) return;
      await connection.execute(
        `SELECT item_code FROM xxafmc_inventory WHERE item_code = ? LIMIT 1 FOR UPDATE`,
        [normalized]
      );
    };

    const getStockQuantity = async (itemCode, categoryId = null) => {
      const normalizedCategory = categoryId == null ? null : Number(categoryId);

      if (normalizedCategory === 10) {
        const [[row]] = await connection.execute(
          `
            SELECT IFNULL(SUM(so.stock_quantity), 0) AS stock_quantity
            FROM xxafmc_stock_out so
            WHERE so.item_code = ?
          `,
          [itemCode]
        );
        return Number(row?.stock_quantity || 0);
      }

      const [[invRow]] = await connection.execute(
        `SELECT IFNULL(STOCK_QUANTITY, 0) AS stock_quantity FROM xxafmc_inventory WHERE item_code = ? LIMIT 1`,
        [itemCode]
      );
      const inventoryStock = Number(invRow?.stock_quantity || 0);

      const [[stockOutRow]] = await connection.execute(
        `
          SELECT IFNULL(SUM(so.stock_quantity), 0) AS stock_quantity
          FROM xxafmc_stock_out so
          WHERE so.item_code = ?
        `,
        [itemCode]
      );
      return Math.max(inventoryStock, Number(stockOutRow?.stock_quantity || 0));
    };

    const getReservedInventoryQty = async (itemCode) => {
      const [[totalsRow]] = await connection.execute(
        `SELECT IFNULL(reserved_qty, 0) AS reserved_qty FROM xxafmc_stock_reservation_totals WHERE item_code = ? LIMIT 1`,
        [itemCode]
      );
      return Number(totalsRow?.reserved_qty || 0);
    };

    const validateInventoryQty = async (itemCode, quantity, categoryId = null, itemName = null) => {
      const normalizedItemCode = Number(itemCode);
      const qty = Number(quantity || 0);
      if (!Number.isFinite(normalizedItemCode) || normalizedItemCode <= 0 || !Number.isFinite(qty) || qty <= 0) {
        return;
      }

      await lockInventoryItem(normalizedItemCode);
      const stockQty = await getStockQuantity(normalizedItemCode, categoryId);
      const reservedQty = await getReservedInventoryQty(normalizedItemCode);
      const availableQty = Math.max(0, stockQty - reservedQty);

      if (qty > availableQty) {
        const error = new Error(`Insufficient stock for ${itemName || normalizedItemCode}. Only ${availableQty} left.`);
        error.statusCode = 400;
        throw error;
      }
    };

    const validateCocktailIngredientsStock = async (cartId, cartQuantity) => {
      const normalizedCartId = Number(cartId);
      if (!Number.isFinite(normalizedCartId) || normalizedCartId <= 0) {
        const error = new Error("Invalid cart item selected");
        error.statusCode = 400;
        throw error;
      }

      const [rows] = await connection.execute(
        `
          SELECT ingredient_item_code, ingredient_name, quantity
          FROM xxafmc_cart_customization
          WHERE cart_id = ?
        `,
        [normalizedCartId]
      );

      if (!rows.length) {
        const error = new Error("Cocktail/mocktail ingredients are missing");
        error.statusCode = 400;
        throw error;
      }

      for (const row of rows) {
        const ingredientCode = Number(row.ingredient_item_code || 0);
        const perUnitQty = Number(row.quantity || 0);
        const requiredQty = perUnitQty * Number(cartQuantity || 1);
        if (!ingredientCode || requiredQty <= 0) continue;

        const [stockQty, reservedQty] = await Promise.all([
          getStockQuantity(ingredientCode),
          getReservedInventoryQty(ingredientCode),
        ]);

        if (requiredQty + reservedQty > stockQty) {
          const availableQty = Math.max(0, stockQty - reservedQty);
          const error = new Error(
            `Out of stock for cocktail/mocktail ingredients (${row.ingredient_name || ingredientCode}). Available quantity: ${availableQty}`
          );
          error.statusCode = 400;
          throw error;
        }
      }
    };

    const validateCombinedStock = async (cartRows) => {
      const stockConsumption = new Map();

      for (const cartItem of cartRows) {
        const quantity = Number(cartItem.quantity || 0);
        const pegType = String(cartItem.description ?? cartItem.DESCRIPTION ?? cartItem.type ?? cartItem.TYPE ?? "").trim();
        const pegMultiplier = getPegMultiplierForType(pegType);
        const stockQuantity = quantity * pegMultiplier;

        // Normal Item
        if (![14, 15].includes(Number(cartItem.sub_category || 0))) {
          const itemCode = Number(cartItem.item_id);
          stockConsumption.set(
            itemCode,
            (stockConsumption.get(itemCode) || 0) + stockQuantity
          );
          continue;
        }

        // Cocktail / Mocktail
        const cartId = Number(cartItem.cart_id);
        const [ingredients] = await connection.execute(
          `
            SELECT ingredient_item_code, ingredient_name, quantity
            FROM xxafmc_cart_customization
            WHERE cart_id = ?
          `,
          [cartId]
        );

        for (const ingredient of ingredients) {
          const ingredientCode = Number(ingredient.ingredient_item_code);
          const requiredQty = Number(ingredient.quantity || 0) * stockQuantity;
          stockConsumption.set(
            ingredientCode,
            (stockConsumption.get(ingredientCode) || 0) + requiredQty
          );
        }
      }

      for (const [itemCode, requiredQty] of stockConsumption.entries()) {
        await lockInventoryItem(itemCode);
        const stockQty = await getStockQuantity(itemCode);
        const reservedQty = await getReservedInventoryQty(itemCode);
        const availableQty = Math.max(0, stockQty - reservedQty);

        if (requiredQty > availableQty) {
          throw new Error(
            `Insufficient stock for item ${itemCode}. Available quantity: ${availableQty}`
          );
        }
      }
    };

    // Helper function to get peg multiplier (same as cart model)
    const getPegMultiplierForType = (type) => {
      const raw = String(type || "").trim();
      return raw.toLowerCase() === "large" ? 2 : 1;
    };

    // 1. Fetch Cart Items and join with inventory to get names and categories
    const [rawCartRows] = await connection.execute(
      `SELECT
        c.*,
        xi.category_id,
        xi.sub_category,
        xi.item_name,
        IFNULL(xi.profit, 0) AS profit,
        IFNULL(xi.non_member_profit, 0) AS non_member_profit,
        IFNULL(xi.pr_charges, 0) AS pr_charges,
        IFNULL(xi.food_pr_charges, 0) AS food_pr_charges,
        IFNULL(xi.\`A/C_UNIT\`, 'Nos') AS ac_unit
       FROM xxafmc_cart_items c 
       JOIN xxafmc_inventory xi ON c.item_id = xi.item_code 
       WHERE c.user_id = ?`,
      [userId]
    );

    if (rawCartRows.length === 0) {
      throw new Error("Cart is empty");
    }

    // Defensive de-dupe: collapse duplicate free/BOGO cart rows
    const dedupeFreeCartRows = (rows) => {
      const freeRowKey = (row) => {
        const itemId = row?.item_id ?? row?.ITEM_ID ?? "";
        const parentCode = row?.parent_code ?? row?.PARENT_CODE ?? "";
        const type = String(row?.type ?? row?.TYPE ?? "").trim().toUpperCase() || "NA";
        return `${itemId}|${parentCode}|${type}`;
      };

      const keptFreeRowByKey = new Map();
      const result = [];

      for (const row of rows) {
        const price = Number(row?.price ?? row?.PRICE ?? 0);
        const total = Number(row?.total ?? row?.TOTAL ?? 0);
        const isFreeRow = price === 0 && total === 0;

        if (!isFreeRow) {
          result.push(row);
          continue;
        }

        const key = freeRowKey(row);
        const existing = keptFreeRowByKey.get(key);

        if (!existing) {
          keptFreeRowByKey.set(key, row);
          result.push(row);
          continue;
        }

        const existingQty = Number(existing?.quantity ?? existing?.QUANTITY ?? 0);
        const rowQty = Number(row?.quantity ?? row?.QUANTITY ?? 0);

        if (rowQty > existingQty) {
          const idx = result.indexOf(existing);
          if (idx !== -1) result.splice(idx, 1);
          keptFreeRowByKey.set(key, row);
          result.push(row);
        }
      }

      return result;
    };

    const cartRows = dedupeFreeCartRows(rawCartRows);

    await validateCombinedStock(cartRows);

    const cocktailCartIds = cartRows
      .filter((row) => [14, 15].includes(Number(row?.sub_category ?? row?.SUB_CATEGORY ?? 0)))
      .map((row) => Number(row?.cart_id ?? row?.CART_ID))
      .filter((cartId) => Number.isFinite(cartId) && cartId > 0);

    const customizedTotalsByCartId = new Map();
    if (cocktailCartIds.length > 0) {
      const uniqueCartIds = [...new Set(cocktailCartIds)];
      const placeholders = uniqueCartIds.map(() => "?").join(",");
      const [customTotalRows] = await connection.execute(
        `
          SELECT
            cart_id,
            ROUND(SUM(IFNULL(line_total, 0)), 2) AS unit_custom_total
          FROM xxafmc_cart_customization
          WHERE cart_id IN (${placeholders})
          GROUP BY cart_id
        `,
        uniqueCartIds
      );

      for (const row of customTotalRows) {
        const cartId = Number(row.cart_id);
        const unitCustomTotal = Number(row.unit_custom_total || 0);
        if (Number.isFinite(cartId) && cartId > 0) {
          customizedTotalsByCartId.set(cartId, unitCustomTotal);
        }
      }
    }

    const getCartLineTotal = (cartItem) => {
      const quantity = Number(cartItem?.quantity ?? cartItem?.QUANTITY ?? 0);
      const rawTotal = Number(cartItem?.total ?? cartItem?.TOTAL ?? 0);
      const cartId = Number(cartItem?.cart_id ?? cartItem?.CART_ID ?? 0);
      const customUnitTotal = customizedTotalsByCartId.get(cartId);

      if (Number.isFinite(customUnitTotal) && customUnitTotal > 0 && quantity > 0) {
        return Number((customUnitTotal * quantity).toFixed(2));
      }

      return rawTotal;
    };

    // Calculate Order Total
    const orderTotal = cartRows.reduce((sum, item) => sum + getCartLineTotal(item), 0);
    let resolvedPubmed = null;
    if (pubmed !== undefined && pubmed !== null && pubmed !== "") {
      const pubmedNumber = Number(pubmed);
      if (Number.isFinite(pubmedNumber) && pubmedNumber > 0) {
        resolvedPubmed = pubmedNumber;
      } else {
        const [pubmedRows] = await connection.execute(
          `
            SELECT pubmed_id
            FROM xxafmc_pubmed
            WHERE UPPER(TRIM(pubmed_name) COLLATE utf8mb4_unicode_ci) =
              UPPER(TRIM(?) COLLATE utf8mb4_unicode_ci)
            LIMIT 1
          `,
          [String(pubmed)]
        );
        resolvedPubmed = pubmedRows[0]?.pubmed_id || null;
      }
    }

    // 1. Create Order Header
    const [headerResult] = await connection.execute(
      `INSERT INTO xxafmc_order_header 
        (user_id, order_date, member_id, pubmed, created_by, creation_date, order_total)
       VALUES (?, NOW(), ?, ?, ?, NOW(), ?)`,
      [userId, memberId || null, resolvedPubmed, req.user?.username || 'SYSTEM', orderTotal]
    );
    const orderNumber = headerResult.insertId;

    const getNextOrderLineId = async () => {
      const [[row]] = await connection.execute(
        `SELECT COALESCE(MAX(order_line_id), 0) + 1 AS nextId FROM xxafmc_order_details`
      );
      return Number(row?.nextId || 1);
    };

    const typeKeyOf = (row) => {
      const raw = String(row?.type ?? row?.TYPE ?? "").trim();
      return (raw || "NA").toUpperCase();
    };

    const isFreeCartRow = (row) => {
      const priceRaw = row?.price ?? row?.PRICE ?? null;
      const totalRaw = row?.total ?? row?.TOTAL ?? null;
      return Number(priceRaw ?? 0) === 0 && Number(totalRaw ?? 0) === 0;
    };

    const paidCartRows = cartRows.filter((row) => !isFreeCartRow(row));
    const freeCartRows = cartRows.filter((row) => isFreeCartRow(row));

    // Builds the fields shared by both INSERT branches
    const buildOrderLineFields = (cartItem) => {
      const itemId = cartItem?.item_id ?? cartItem?.ITEM_ID ?? cartItem?.itemId ?? null;
      if (itemId === null || itemId === undefined) {
        throw new Error("Cart item is missing item_id");
      }

      const cartQtyRaw = cartItem?.quantity ?? cartItem?.QUANTITY ?? null;
      const cartPriceRaw = cartItem?.price ?? cartItem?.PRICE ?? null;
      const cartTotalRaw = getCartLineTotal(cartItem);
      const cartDescriptionRaw = cartItem?.description ?? cartItem?.DESCRIPTION ?? null;
      const cartSubcategoryRaw =
        cartItem?.sub_category ?? cartItem?.SUB_CATEGORY ?? cartItem?.subCategory ?? cartItem?.SUBCATEGORY ?? null;
      const cartCategoryIdRaw = cartItem?.category_id ?? cartItem?.CATEGORY_ID ?? null;

      const quantity = Number(cartQtyRaw ?? 0);
      const rawUnitPrice = cartPriceRaw ?? null;
      const lineSubtotal = cartTotalRaw ?? null;
      const subCategory = cartSubcategoryRaw ?? null;
      const roleId = Number(req.user?.roleId || 0);
      const isNonMember = usesNonMemberPricing({
        roleId,
        loginType: req.user?.loginType,
      });
      const isNonAlcoholicLiquorItem =
        Number(cartCategoryIdRaw) === 10 && isExcludedLiquorSubcategory(cartSubcategoryRaw);
      const profit = isNonAlcoholicLiquorItem
        ? 0
        : isNonMember
          ? Number(cartItem.non_member_profit || 0)
          : Number(cartItem.profit || 0);
      const foodPrCharges = isNonAlcoholicLiquorItem
        ? 0
        : isNonMember
          ? Number(cartItem.pr_charges || 0)
          : Number(cartItem.food_pr_charges || 0);

      const isFreeRow = Number(rawUnitPrice || 0) === 0 && Number(lineSubtotal || 0) === 0;
      const unitPrice = isFreeRow ? rawUnitPrice : null;

      return {
        itemId,
        quantity,
        unitPrice,
        lineSubtotal,
        subCategory,
        profit,
        foodPrCharges,
        cartCategoryIdRaw,
        cartDescriptionRaw,
        isFreeRow,
      };
    };

    const insertOrderDetailRow = async (cartItem, fields, { orderLineId, barcode, totalQuantity }) => {
      const {
        itemId, quantity, unitPrice, lineSubtotal,
        subCategory, profit, foodPrCharges, cartCategoryIdRaw, cartDescriptionRaw,
      } = fields;

      if (Number(cartCategoryIdRaw) === 10) {
        const typeName = String(cartDescriptionRaw ?? cartItem.ac_unit ?? "Nos").trim() || "Nos";
        const [typeRows] = await connection.execute(
          `SELECT type_id FROM xxafmc_bar WHERE UPPER(type) = UPPER(?) LIMIT 1`,
          [typeName]
        );
        const typeId = typeRows?.[0]?.type_id ?? null;

        await connection.execute(
          `INSERT INTO xxafmc_order_details
            (order_line_id, order_id, item_id, type_id, quantity, type, price, subtotal, total_quantity, created_by, creation_date, subcategory, profit, food_pr_charges, barcode)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?)`,
          [
            orderLineId,
            orderNumber,
            itemId,
            typeId,
            quantity,
            typeName,
            unitPrice,
            lineSubtotal,
            totalQuantity,
            req.user?.username || "SYSTEM",
            subCategory,
            profit,
            foodPrCharges,
            barcode,
          ]
        );
      } else {
        await connection.execute(
          `INSERT INTO xxafmc_order_details
            (order_line_id, order_id, item_id, quantity, price, subtotal, total_quantity, created_by, creation_date, subcategory, profit, food_pr_charges, barcode)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?)`,
          [
            orderLineId,
            orderNumber,
            itemId,
            quantity,
            unitPrice,
            lineSubtotal,
            totalQuantity,
            req.user?.username || "SYSTEM",
            subCategory,
            profit,
            foodPrCharges,
            barcode,
          ]
        );
      }
    };

    // Pass 1: insert every PAID line first
    const paidLineByKey = new Map(); // "itemId|TYPEKEY" -> { orderLineId, quantity, pegMultiplier }

    for (const cartItem of paidCartRows) {
      const fields = buildOrderLineFields(cartItem);
      const orderLineId = await getNextOrderLineId();

      await insertOrderDetailRow(cartItem, fields, {
        orderLineId,
        barcode: null,
        totalQuantity: fields.quantity,
      });

      const key = `${fields.itemId}|${typeKeyOf(cartItem)}`;
      const pegMultiplier = getPegMultiplierForType(cartItem?.description ?? cartItem?.DESCRIPTION ?? '');
      paidLineByKey.set(key, { 
        orderLineId, 
        quantity: fields.quantity,
        pegMultiplier,
        cartItem // Store the original cart item for later reference
      });
    }

    // Pass 2: insert every FREE line with PEG MULTIPLIER applied
    for (const cartItem of freeCartRows) {
      const fields = buildOrderLineFields(cartItem);
      const parentCodeRaw = cartItem?.parent_code ?? cartItem?.PARENT_CODE ?? null;
      const hasParentCode = parentCodeRaw !== null && parentCodeRaw !== undefined && parentCodeRaw !== "";
      const parentItemId = hasParentCode ? Number(parentCodeRaw) : fields.itemId;
      const parentKey = `${parentItemId}|${typeKeyOf(cartItem)}`;
      const parentLine = paidLineByKey.get(parentKey);

      if (!parentLine) {
        console.error(
          `Skipping free/BOGO cart row for order ${orderNumber}: no matching paid line found for parent key ${parentKey} (item_id ${fields.itemId})`
        );
        continue;
      }

      // CRITICAL FIX: Apply peg multiplier to free item quantity!
      // The free item quantity in the cart is the BASE quantity.
      // For Large items, it needs to be multiplied by 2.
      const pegMultiplier = parentLine.pegMultiplier || 1;
      const freeQuantity = fields.quantity * pegMultiplier;

      // console.log(`[CONFIRM-ORDER] Free item ${fields.itemId} (parent type multiplier: ${pegMultiplier}):`, {
      //   cartQuantity: fields.quantity,
      //   pegMultiplier,
      //   freeQuantity,
      //   parentLineId: parentLine.orderLineId
      // });

      const orderLineId = await getNextOrderLineId();
      
      // Update fields with peg-multiplied quantity
      const freeFields = {
        ...fields,
        quantity: freeQuantity,
        lineSubtotal: 0, // Free items have zero subtotal
        unitPrice: 0,
      };

      await insertOrderDetailRow(cartItem, freeFields, {
        orderLineId,
        barcode: String(parentLine.orderLineId),
        totalQuantity: parentLine.quantity,
      });
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

    // Recompute order_total from order_details
    try {
      const [totalRows] = await connection.execute(
        `SELECT COALESCE(ROUND(SUM(IFNULL(subtotal, 0) + IFNULL(food_pr_charges, 0) * IFNULL(quantity, 0)), 2), 0) AS computed_total FROM xxafmc_order_details WHERE order_id = ?`,
        [orderNumber]
      );
      const computedTotal = Number(totalRows[0]?.computed_total || 0);
      await connection.execute(`UPDATE xxafmc_order_header SET order_total = ? WHERE order_num = ?`, [computedTotal, orderNumber]);
    } catch (e) {
      console.error('Failed to recompute order_total for order', orderNumber, e);
    }

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
    const message = error?.message || "Failed to confirm order";
    const status =
      error?.statusCode ||
      error?.status ||
      (message.toLowerCase().includes("insufficient stock") || message.toLowerCase().includes("out of stock")
        ? 400
        : 500);
    return res.status(status).json({ success: false, message });
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

exports.getIngredientStocks = async (req, res) => {
  try {
    const rawCodes = String(req.query?.codes || "").trim();
    if (!rawCodes) {
      return res.status(400).json({ success: false, message: "codes is required" });
    }

    const codes = rawCodes
      .split(",")
      .map((code) => Number(String(code).trim()))
      .filter((code) => Number.isFinite(code) && code > 0);

    if (codes.length === 0) {
      return res.status(400).json({ success: false, message: "codes must be a comma-separated list of item codes" });
    }

    // Support multiple client param names:
    // - excludeOrderNumber (legacy)
    // - orderNumber / buyOrderNumber (buy-flow)
    const rawExcludeOrderNumber = String(
      req.query?.excludeOrderNumber || req.query?.buyOrderNumber || req.query?.orderNumber || ""
    ).trim();
    const excludeOrderNumber = Number.isFinite(Number(rawExcludeOrderNumber)) && Number(rawExcludeOrderNumber) > 0
      ? Number(rawExcludeOrderNumber)
      : null;

    const rawExcludeCartId = String(req.query?.excludeCartId || "").trim();
    const excludeCartId = Number.isFinite(Number(rawExcludeCartId)) && Number(rawExcludeCartId) > 0
      ? Number(rawExcludeCartId)
      : null;

    const ignoreOwnCart = String(req.query?.ignoreOwnCart || "").trim().toLowerCase() === "true";

    const data = await cartModel.getIngredientStockMap(
      codes,
      excludeOrderNumber,
      req.user?.userId,
      excludeCartId,
      ignoreOwnCart
    );
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error fetching ingredient stocks:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch ingredient stocks" });
  }
};