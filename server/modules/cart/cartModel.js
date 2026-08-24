const db = require("../../config/db");
const { usesNonMemberPricing } = require("../../helpers/customerPricing");
const { isExcludedLiquorSubcategory } = require("../../helpers/pricingHelper");

const CUSTOMIZATION_TABLE = "xxafmc_cart_customization";

const createValidationError = (message) => {
  const error = new Error(message);
  error.status = 400;
  return error;
};
const getPegTypeValue = (value) => {
  const raw = value?.description ?? value?.DESCRIPTION ?? value?.type ?? value?.TYPE ?? value ?? null;
  return String(raw ?? "").trim();
};

const getPegMultiplierForType = (type) => {
  return getPegTypeValue(type).toLowerCase() === "large" ? 2 : 1;
};

// Canonical key used ONLY for the TYPE column when storing/looking up a
// cart row's paid or free-item counterpart. Trims + uppercases so "Small",
// " small", and "SMALL " all resolve to the same key, and blank/undefined
// always resolves to the same "NA" sentinel. This must be the ONLY place
// that decides the TYPE-column value so add/update/delete never disagree
// on what an empty type normalizes to (that mismatch was the cause of
// duplicate "Free Item (BOGO)" rows for the same item/type).
const normalizeCartTypeKey = (type) => {
  const raw = String(type ?? "").trim();
  return (raw || "NA").toUpperCase();
};

const getEffectiveAvailableQuantityForType = (rawAvailableQty, type) => {
  const rawQty = Number(rawAvailableQty);
  if (!Number.isFinite(rawQty) || rawQty <= 0) return 0;
  const multiplier = getPegMultiplierForType(type);
  return multiplier > 1 ? Math.max(0, Math.floor(rawQty / multiplier)) : rawQty;
};

// Sums quantity * pegMultiplier across all cart rows for this item (optionally excluding one cart_id).
// This makes stock checks type-aware: a Large row consumes 2x the pegs of an equal-quantity Small row.
const getCartPegWeightedQuantity = async (conn, userId, itemCode, excludeCartId = null) => {
  // NOTE: intentionally NOT filtering by price != 0 here. Free/BOGO rows of this
  // same item (e.g. free Gilded Frost from a BOGO offer) still occupy physical
  // stock and must count toward consumption, or stock checks will overstate
  // what's actually available.
  let query = `SELECT quantity, description, type, price FROM xxafmc_cart_items
     WHERE user_id = ?
       AND item_id = ?`;
  const params = [userId, itemCode];

  if (excludeCartId != null && !Number.isNaN(Number(excludeCartId))) {
    query += " AND cart_id <> ?";
    params.push(Number(excludeCartId));
  }

  const [rows] = await conn.execute(query, params);
  return rows.reduce((sum, row) => {
    const qty = Number(row.quantity || 0);
    // Free/BOGO rows (price = 0) already store their quantity in peg-weighted
    // UNITS (see addCartItem/updateCartItemQuantity: totalFreeUnits is computed
    // in units before being saved), so applying the peg multiplier again here
    // would double-count them. Only paid rows store a raw item count that still
    // needs the multiplier applied.
    const isFreeRow = Number(row.price) === 0;
    const multiplier = isFreeRow ? 1 : getPegMultiplierForType(row.type);
    return sum + qty * multiplier;
  }, 0);
};
const getStockQuantity = async (conn, itemCode, categoryId = null) => {
  const normalizedCategory = categoryId == null ? null : Number(categoryId);
  if (normalizedCategory === 10) {
    const [[stockRow]] = await conn.execute(
      `SELECT IFNULL(SUM(STOCK_QUANTITY), 0) AS stock
       FROM xxafmc_stock_out
       WHERE item_code = ?`,
      [itemCode]
    );

    return Number(stockRow?.stock || 0);
  }

  const [[invRow]] = await conn.execute(
    `SELECT IFNULL(STOCK_QUANTITY, 0) AS stock FROM xxafmc_inventory WHERE item_code = ? LIMIT 1`,
    [itemCode]
  );

  const [[stockRow]] = await conn.execute(
    `SELECT IFNULL(SUM(STOCK_QUANTITY), 0) AS stock
     FROM xxafmc_stock_out
     WHERE item_code = ?`,
    [itemCode]
  );

  return Math.max(Number(invRow?.stock || 0), Number(stockRow?.stock || 0));
};

const getReservedTotalsQuantities = async (conn, itemCodes) => {
  const normalizedCodes = [...new Set((Array.isArray(itemCodes) ? itemCodes : [])
    .map((code) => Number(code))
    .filter((code) => Number.isFinite(code) && code > 0))];

  if (normalizedCodes.length === 0) return new Map();

  const placeholders = normalizedCodes.map(() => "?").join(",");
  const [rows] = await conn.execute(
    `
      SELECT item_code, IFNULL(reserved_qty, 0) AS reserved_qty
      FROM xxafmc_stock_reservation_totals
      WHERE item_code IN (${placeholders})
    `,
    normalizedCodes
  );

  const reservedMap = normalizedCodes.reduce((map, code) => {
    map.set(String(code), 0);
    return map;
  }, new Map());

  return rows.reduce((map, row) => {
    map.set(String(row.item_code), Number(row.reserved_qty || 0));
    return map;
  }, reservedMap);
};

const getOrderReservedQuantity = async (conn, itemCode) => {
  const reservedTotals = await getReservedTotalsQuantities(conn, [itemCode]);
  return Number(reservedTotals.get(String(itemCode)) || 0);
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

const getCartQuantityExcludingCartId = async (conn, userId, itemCode, priceZero = false, excludeCartId = null) => {
  const priceCondition = priceZero ? "= 0" : "!= 0";
  let query = `SELECT IFNULL(SUM(quantity), 0) AS qty
     FROM xxafmc_cart_items
     WHERE user_id = ?
       AND item_id = ?
       AND price ${priceCondition}`;
  const params = [userId, itemCode];

  if (excludeCartId != null && !Number.isNaN(Number(excludeCartId))) {
    query += " AND cart_id <> ?";
    params.push(Number(excludeCartId));
  }

  const [rows] = await conn.execute(query, params);
  return Number(rows[0]?.qty || 0);
};

const getCartIngredientConsumption = async (conn, userId, ingredientCode, excludeCartId = null) => {
  const normalizedCode = Number(ingredientCode);
  if (!Number.isFinite(normalizedCode) || normalizedCode <= 0) return 0;
  let excludeSql = "";
  const params = [userId, normalizedCode];
  if (excludeCartId != null && !Number.isNaN(Number(excludeCartId))) {
    excludeSql = " AND c.cart_id <> ?";
    params.push(Number(excludeCartId));
  }
  const [rows] = await conn.execute(
    `SELECT cc.quantity AS ingredient_qty, c.quantity AS cart_qty, c.description, c.type
     FROM ${CUSTOMIZATION_TABLE} cc
     INNER JOIN xxafmc_cart_items c
       ON cc.cart_id = c.cart_id
     WHERE c.user_id = ?
       AND cc.ingredient_item_code = ?
       AND c.price != 0${excludeSql}`,
    params
  );
  return rows.reduce((sum, row) => {
    const multiplier = getPegMultiplierForType(row);
    return sum + Number(row.ingredient_qty || 0) * Number(row.cart_qty || 0) * multiplier;
  }, 0);
};

const getCartIngredientConsumptionMap = async (conn, userId, ingredientCodes, excludeCartId = null) => {
  const normalizedCodes = [...new Set((Array.isArray(ingredientCodes) ? ingredientCodes : [])
    .map((code) => Number(code))
    .filter((code) => Number.isFinite(code) && code > 0))];

  if (normalizedCodes.length === 0) return {};

  const placeholders = normalizedCodes.map(() => "?").join(",");
  const params = [userId, ...normalizedCodes];
  let excludeSql = "";
  if (excludeCartId != null && !Number.isNaN(Number(excludeCartId))) {
    excludeSql = " AND c.cart_id <> ?";
    params.push(Number(excludeCartId));
  }

  const [rows] = await conn.execute(
    `SELECT cc.ingredient_item_code AS item_code, cc.quantity AS ingredient_qty, c.quantity AS cart_qty, c.description, c.type
     FROM ${CUSTOMIZATION_TABLE} cc
     INNER JOIN xxafmc_cart_items c
       ON cc.cart_id = c.cart_id
     WHERE c.user_id = ?
       AND cc.ingredient_item_code IN (${placeholders})
       AND c.price != 0${excludeSql}`,
    params
  );

  return rows.reduce((map, row) => {
    const key = String(row.item_code);
    const multiplier = getPegMultiplierForType(row);
    const weightedQty = Number(row.ingredient_qty || 0) * Number(row.cart_qty || 0) * multiplier;
    map[key] = Number(map[key] || 0) + weightedQty;
    return map;
  }, {});
};

const getCartConsumptionMap = async (conn, userId, itemCodes, excludeCartId = null) => {
  const normalizedCodes = [...new Set((Array.isArray(itemCodes) ? itemCodes : [])
    .map((code) => Number(code))
    .filter((code) => Number.isFinite(code) && code > 0))];

  if (normalizedCodes.length === 0) return {};

  const placeholders = normalizedCodes.map(() => "?").join(",");
  const params = [userId, ...normalizedCodes];
  let excludeSql = "";
  let excludeSqlForIngredient = "";
  if (excludeCartId != null && !Number.isNaN(Number(excludeCartId))) {
    excludeSql = " AND cart_id <> ?";
    excludeSqlForIngredient = " AND c.cart_id <> ?";
    params.push(Number(excludeCartId));
  }

  // NOTE: intentionally NOT filtering by price != 0 here, for the same reason as
  // getCartPegWeightedQuantity above — a free/BOGO row of Gilded Frost (or any
  // other item) still consumes real stock and must be counted.
  const [directRows] = await conn.execute(
    `SELECT item_id AS item_code, quantity, description, type, price
     FROM xxafmc_cart_items
     WHERE user_id = ?
       AND item_id IN (${placeholders})${excludeSql}`,
    params
  );

  const [ingredientRows] = await conn.execute(
    `SELECT cc.ingredient_item_code AS item_code, cc.quantity AS ingredient_qty, c.quantity AS cart_qty, c.description, c.type
     FROM ${CUSTOMIZATION_TABLE} cc
     INNER JOIN xxafmc_cart_items c
       ON cc.cart_id = c.cart_id
     WHERE c.user_id = ?
       AND cc.ingredient_item_code IN (${placeholders})
       AND c.price != 0${excludeSqlForIngredient}`,
    params
  );

  const map = {};
  for (const row of directRows) {
    const key = String(row.item_code);
    // Same reasoning as getCartPegWeightedQuantity: free/BOGO rows (price = 0)
    // already store their quantity in peg-weighted UNITS (see addCartItem /
    // updateCartItemQuantity, which computes totalFreeUnits before saving), so
    // re-applying the peg multiplier here would double-count them. Only paid
    // rows still hold a raw item count that needs the multiplier applied.
    const isFreeRow = Number(row.price) === 0;
    const multiplier = isFreeRow ? 1 : getPegMultiplierForType(row);
    map[key] = Number(map[key] || 0) + Number(row.quantity || 0) * multiplier;
  }
  for (const row of ingredientRows) {
    const key = String(row.item_code);
    const multiplier = getPegMultiplierForType(row);
    const weightedQty = Number(row.ingredient_qty || 0) * Number(row.cart_qty || 0) * multiplier;
    map[key] = Number(map[key] || 0) + weightedQty;
  }

  return map;
};

const isCocktailOrMocktailInfo = (itemInfo) =>
  (Number(itemInfo?.category_id) === 10 && [14, 15].includes(Number(itemInfo?.sub_category))) ||
  Number(itemInfo?.has_recipe || 0) > 0;

const ensureCustomizationTable = async (conn = db) => {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS ${CUSTOMIZATION_TABLE} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      cart_id INT NOT NULL,
      ingredient_item_code INT NOT NULL,
      ingredient_name VARCHAR(255),
      quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
      unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
      line_total DECIMAL(12,2) NOT NULL DEFAULT 0,
      creation_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_updated_date DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_cart_customization_cart_id (cart_id),
      INDEX idx_cart_customization_item_code (ingredient_item_code)
    )
  `);
};

const getIngredientMetaRows = async (conn, itemCodes) => {
  const normalizedCodes = [...new Set((Array.isArray(itemCodes) ? itemCodes : [])
    .map((code) => Number(code))
    .filter((code) => Number.isFinite(code) && code > 0))];

  if (normalizedCodes.length === 0) return new Map();

  const placeholders = normalizedCodes.map(() => "?").join(",");
  const [rows] = await conn.execute(
    `
      SELECT
        ITEM_CODE,
        ITEM_NAME,
        UNIT_PRICE
      FROM xxafmc_inventory
      WHERE ITEM_CODE IN (${placeholders})
    `,
    normalizedCodes
  );

  return rows.reduce((map, row) => {
    map.set(String(row.ITEM_CODE), row);
    return map;
  }, new Map());
};

const getDefaultCocktailIngredientRows = async (
  conn,
  parentItemCode,
  loginType = "",
  cartQuantity = 1,
  roleId = null
) => {
  const isNonMember = usesNonMemberPricing({ roleId, loginType });
  const [rows] = await conn.execute(
    `
      SELECT
        recipe.ITEM_CODE,
        recipe.ITEM_NAME,
        recipe.PEGS,
        recipe.PRICE,
        recipe.NON_MEMBER_PRICE
      FROM xxafmc_cocktails_mocktails_details recipe
      INNER JOIN xxafmc_inventory inventory
        ON inventory.ITEM_CODE = recipe.ITEM_CODE
      WHERE recipe.INVENTORY_ITEM_CODE = ?
        AND inventory.STATUS = 'ACTIVE'
      ORDER BY COALESCE(recipe.MOC_ID, 0), recipe.ITEM_NAME
    `,
    [parentItemCode]
  );

  const baseIngredients = rows.map((row) => {
    const quantity = Number(row.PEGS || 0);
    const selectedPrice = isNonMember
      ? Number(row.NON_MEMBER_PRICE ?? row.PRICE ?? 0)
      : Number(row.PRICE ?? row.NON_MEMBER_PRICE ?? 0);
    const unitPrice = quantity > 0 ? selectedPrice / quantity : selectedPrice;
    const lineTotal = Number((unitPrice * quantity).toFixed(2));

    return {
      itemCode: Number(row.ITEM_CODE),
      itemName: row.ITEM_NAME,
      quantity,
      unitPrice: Number(unitPrice.toFixed(2)),
      lineTotal,
    };
  });

  // Enrich with stock information
  return await enrichIngredientsWithStock(conn, baseIngredients, cartQuantity);
};

const validateCustomizationStock = async (conn, ingredients, cartQuantity = 1, userId = null, excludeCartId = null) => {
  const ingredientCodes = [...new Set((Array.isArray(ingredients) ? ingredients : [])
    .map((ingredient) => Number(ingredient?.itemCode))
    .filter((code) => Number.isFinite(code) && code > 0))];
  const stockMap = await getIngredientStockQuantities(conn, ingredientCodes);
  const reservedMap = await getIngredientReservedQuantities(conn, ingredientCodes);
  const consumptionMap = userId
    ? await getCartConsumptionMap(conn, userId, ingredientCodes, excludeCartId)
    : {};

  for (const ingredient of ingredients) {
    const itemCode = Number(ingredient.itemCode);
    const requiredQty = Number(ingredient.quantity || 0) * Number(cartQuantity || 1);
    if (!itemCode || requiredQty <= 0) continue;

    const stockQty = Number(stockMap[String(itemCode)] || 0);
    const reservedQty = Number(reservedMap[String(itemCode)] || 0);
    const consumedQty = Number(consumptionMap[String(itemCode)] || 0);
    const availableQty = Math.max(0, stockQty - reservedQty - consumedQty);

    if (requiredQty > availableQty) {
      const ingredientName = ingredient.itemName || itemCode || "ingredient";
      const parentSuffix = ingredient.parentItemName ? ` for ${ingredient.parentItemName}` : "";
      throw createValidationError(
        `Only ${availableQty} ${ingredientName} available${parentSuffix}.`
      );
    }
  }
};

const enrichIngredientsWithStock = async (conn, ingredients, cartQuantity = 1) => {
  if (ingredients.length === 0) return ingredients;

  const itemCodes = ingredients.map((ing) => Number(ing.itemCode)).filter((code) => Number.isFinite(code) && code > 0);
  const stockMap = await getIngredientStockQuantities(conn, itemCodes);
  const reservedMap = await getIngredientReservedQuantities(conn, itemCodes);

  return ingredients.map((ingredient) => {
    const itemCode = Number(ingredient.itemCode);
    const quantity = Number(ingredient.quantity || 0);
    const cartQty = Number(cartQuantity || 1);
    const requiredQuantity = quantity * cartQty;
    const stockQuantity = Number(stockMap[String(itemCode)] || 0);
    const reservedQuantity = Number(reservedMap[String(itemCode)] || 0);
    const availableQuantity = Math.max(0, stockQuantity - reservedQuantity);
    const stockStatus = availableQuantity >= requiredQuantity ? "In Stock" : "Out Of Stock";

    return {
      ...ingredient,
      requiredQuantity,
      stockQuantity: availableQuantity,
      stockStatus,
    };
  });
};

const replaceCartCustomization = async (conn, cartId, ingredients) => {
  await conn.execute(`DELETE FROM ${CUSTOMIZATION_TABLE} WHERE cart_id = ?`, [cartId]);

  for (const ingredient of ingredients) {
    const quantity = Number(ingredient.quantity || 0);
    const unitPrice = Number(ingredient.unitPrice || 0);
    const lineTotal = Number((unitPrice * quantity).toFixed(2));

    await conn.execute(
      `
        INSERT INTO ${CUSTOMIZATION_TABLE}
          (cart_id, ingredient_item_code, ingredient_name, quantity, unit_price, line_total, creation_date, last_updated_date)
        VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
      `,
      [
        cartId,
        Number(ingredient.itemCode),
        ingredient.itemName || null,
        quantity,
        unitPrice,
        lineTotal,
      ]
    );
    //     console.log("Inserting ingredient:", {
    //   cartId,
    //   itemCode: ingredient.itemCode,
    //   itemName: ingredient.itemName,
    //   quantity: ingredient.quantity,
    //   unitPrice: ingredient.unitPrice,
    //   lineTotal: lineTotal,
    // });
  }
};

const createDefaultCustomizationForCart = async (conn, { cartId, parentItemCode, cartQuantity, loginType, roleId }) => {
  const ingredients = await getDefaultCocktailIngredientRows(conn, parentItemCode, loginType, cartQuantity, roleId);
  await validateCustomizationStock(conn, ingredients, cartQuantity);
  await replaceCartCustomization(conn, cartId, ingredients);
  return ingredients;
};

const normalizeCustomizationUpdates = async (conn, updates, cartQuantity = 1) => {
  const normalized = (Array.isArray(updates) ? updates : [])
    .map((item) => ({
      itemCode: Number(item?.itemCode ?? item?.ingredient_item_code ?? item?.ingredientItemCode),
      quantity: Number(item?.quantity),
      itemName: item?.itemName ?? item?.ingredientName ?? item?.name,
      unitPrice: item?.unitPrice != null ? Number(item.unitPrice) : null,
    }))
    .filter((item) => Number.isFinite(item.itemCode) && item.itemCode > 0 && Number.isFinite(item.quantity) && item.quantity >= 0);

  const metaMap = await getIngredientMetaRows(conn, normalized.map((item) => item.itemCode));

  const enriched = normalized.map((item) => {
    const meta = metaMap.get(String(item.itemCode));
    const itemName = item.itemName || meta?.ITEM_NAME || String(item.itemCode);
    const unitPrice = item.unitPrice != null && Number.isFinite(item.unitPrice)
      ? item.unitPrice
      : Number(meta?.UNIT_PRICE || 0);
    const lineTotal = Number((unitPrice * item.quantity).toFixed(2));

    return {
      itemCode: item.itemCode,
      itemName,
      quantity: item.quantity,
      unitPrice: Number(unitPrice.toFixed(2)),
      lineTotal,
    };
  });

  // Enrich with stock information
  return await enrichIngredientsWithStock(conn, enriched, cartQuantity);
};

const getIngredientStockQuantities = async (conn, itemCodes) => {
  const normalizedCodes = [...new Set((Array.isArray(itemCodes) ? itemCodes : [])
    .map((code) => Number(code))
    .filter((code) => Number.isFinite(code) && code > 0))];

  if (normalizedCodes.length === 0) return {};

  const placeholders = normalizedCodes.map(() => "?").join(",");

  const [stockOutRows] = await conn.execute(
    `SELECT item_code, IFNULL(SUM(stock_quantity), 0) AS stock_quantity
     FROM xxafmc_stock_out
     WHERE item_code IN (${placeholders})
     GROUP BY item_code`,
    normalizedCodes
  );

  return stockOutRows.reduce((map, row) => {
    map[String(row.item_code)] = Number(row.stock_quantity || 0);
    return map;
  }, {});
};
const getIngredientReservedQuantities = async (conn, itemCodes) => {
  const normalizedCodes = [...new Set((Array.isArray(itemCodes) ? itemCodes : [])
    .map((code) => Number(code))
    .filter((code) => Number.isFinite(code) && code > 0))];

  if (normalizedCodes.length === 0) return {};

  const reservedTotals = await getReservedTotalsQuantities(conn, normalizedCodes);
  return normalizedCodes.reduce((map, code) => {
    map[String(code)] = Number(reservedTotals.get(String(code)) || 0);
    return map;
  }, {});
};

const getCartCustomization = async (cartId, userId) => {
  await ensureCustomizationTable(db);

  const [rows] = await db.execute(
    `
      SELECT
        cc.id,
        cc.cart_id,
        cc.ingredient_item_code,
        cc.ingredient_name,
        cc.quantity,
        cc.unit_price,
        cc.line_total,
        c.quantity AS cart_quantity,
        inv.STATUS AS ingredient_status  
      FROM ${CUSTOMIZATION_TABLE} cc
      INNER JOIN xxafmc_cart_items c
        ON c.cart_id = cc.cart_id
      INNER JOIN xxafmc_inventory inv  
        ON inv.ITEM_CODE = cc.ingredient_item_code
      WHERE cc.cart_id = ?
        AND c.user_id = ?
        AND inv.STATUS = 'ACTIVE'  
      ORDER BY cc.id
    `,
    [cartId, userId]
  );

  // If no active ingredients found, return empty
  if (rows.length === 0) {
    return {
      cartId: Number(cartId),
      cartItemQuantity: 1,
      ingredients: [],
      totalPrice: 0,
    };
  }

  const itemCodes = rows.map((row) => row.ingredient_item_code);
  const stockMap = await getIngredientStockQuantities(db, itemCodes);
  const reservedMap = await getIngredientReservedQuantities(db, itemCodes);

  const ingredients = rows.map((row) => {
    const quantity = Number(row.quantity || 0);
    const cartItemQuantity = Number(row.cart_quantity || 1);
    const requiredQuantity = quantity * cartItemQuantity;
    const stockQuantity = Number(stockMap[String(row.ingredient_item_code)] || 0);
    const reservedQuantity = Number(reservedMap[String(row.ingredient_item_code)] || 0);
    const availableQuantity = Math.max(0, stockQuantity - reservedQuantity);
    const stockStatus = availableQuantity >= requiredQuantity ? "In Stock" : "Out Of Stock";

    return {
      id: Number(row.id),
      cartId: Number(row.cart_id),
      itemCode: Number(row.ingredient_item_code),
      itemName: row.ingredient_name,
      quantity,
      requiredQuantity,
      unitPrice: Number(row.unit_price || 0),
      lineTotal: Number(row.line_total || 0),
      stockQuantity: availableQuantity,
      stockStatus,
      ingredientStatus: row.ingredient_status,
    };
  });

  // console.log("Active ingredients:", ingredients);

  return {
    cartId: Number(cartId),
    cartItemQuantity: Number(rows[0]?.cart_quantity || 1),
    ingredients,
    totalPrice: Number(ingredients.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0).toFixed(2)),
  };
};
const updateCartCustomization = async (cartId, userId, updates) => {
  const conn = await db.getConnection();

  try {
    await ensureCustomizationTable(conn);
    await conn.beginTransaction();

    const [cartRows] = await conn.execute(
      `
        SELECT
          c.cart_id,
          c.item_id,
          c.quantity,
          xi.category_id,
          xi.sub_category,
          EXISTS (
            SELECT 1
            FROM xxafmc_cocktails_mocktails_details recipe
            WHERE recipe.inventory_item_code = c.item_id
            LIMIT 1
          ) AS has_recipe
        FROM xxafmc_cart_items c
        LEFT JOIN xxafmc_inventory xi ON c.item_id = xi.item_code
        WHERE c.cart_id = ?
          AND c.user_id = ?
         AND c.parent_code IS NULL
        LIMIT 1
      `,
      [cartId, userId]
    );

    const cartItem = cartRows[0];
    // console.log(cartItem);
    if (!cartItem) {
      const error = new Error("Cart item not found");
      error.status = 404;
      throw error;
    }

    if (!isCocktailOrMocktailInfo(cartItem)) {
      const error = new Error("Cart item is not a cocktail or mocktail");
      error.status = 400;
      throw error;
    }

    const cartQuantity = Number(cartItem.quantity || 1);
    // const ingredients = await normalizeCustomizationUpdates(conn, updates, cartQuantity);

    // if (ingredients.length > 0) {
    //   await validateCustomizationStock(conn, ingredients, cartQuantity, userId, cartId);
    // }
    // console.log("validateCustomizationStock", validateCustomizationStock)
    // console.log("ingredients", ingredients);

    //     console.log("Cart ID:", cartId);
    // console.log("User ID:", userId);
    // console.log("Ingredients received from UI:");
    // console.log(JSON.stringify(ingredients, null, 2));
    const ingredients = await normalizeCustomizationUpdates(conn, updates, cartQuantity);
    if (ingredients.length === 0) {
      const error = new Error("A cocktail/mocktail must have at least one ingredient.");
      error.status = 400;
      throw error;
    }

    // Only re-validate ingredients whose required quantity is increasing vs. what's
    // already saved. This lets deletions and untouched out-of-stock ingredients
    // through without blocking the whole save.
    const [existingRows] = await conn.execute(
      `SELECT ingredient_item_code, quantity FROM ${CUSTOMIZATION_TABLE} WHERE cart_id = ?`,
      [cartId]
    );
    const existingQtyMap = existingRows.reduce((map, row) => {
      map[String(row.ingredient_item_code)] = Number(row.quantity || 0);
      return map;
    }, {});

    const ingredientsNeedingValidation = ingredients.filter((ing) => {
      const existingQty = existingQtyMap[String(ing.itemCode)];
      if (existingQty === undefined) return true; // brand new ingredient — validate
      return Number(ing.quantity) > existingQty;   // only validate real increases
    });

    if (ingredientsNeedingValidation.length > 0) {
      await validateCustomizationStock(conn, ingredientsNeedingValidation, cartQuantity, userId, cartId);
    }
    await replaceCartCustomization(conn, cartId, ingredients);

    //     console.log("Saving ingredients into xxafmc_cart_customization table:");
    // ingredients.forEach((ing) => {
    //   console.log(
    //     `ItemCode=${ing.itemCode}, Name=${ing.itemName}, Qty=${ing.quantity}, UnitPrice=${ing.unitPrice}`
    //   );
    // });



    const unitPrice = Number(ingredients.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0).toFixed(2));
    await conn.execute(
      `UPDATE xxafmc_cart_items SET price = ?, total = ? * quantity, last_updated_by = ?, last_updated_date = NOW() WHERE cart_id = ? AND user_id = ?`,
      [unitPrice, unitPrice, userId, cartId, userId]
    );

    await conn.commit();
    return {
      cartId: Number(cartId),
      cartItemQuantity: cartQuantity,
      ingredients,
      totalPrice: unitPrice,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const addCartItem = async (userId, itemData) => {
  const { item_id, quantity = 1, unit_price = 0, remarks, type, loginType, roleId, customIngredients } = itemData;
  const normalizedQuantity = Number(quantity);

  if (!Number.isInteger(normalizedQuantity) || normalizedQuantity < 1) {
    const error = new Error("Quantity must be at least 1");
    error.status = 400;
    throw error;
  }

  const conn = await db.getConnection();

  try {
    const requestedId = Number(item_id);
    const [[resolvedRow]] = await conn.execute(
      `
        SELECT inv.item_code
        FROM xxafmc_inventory inv
        WHERE inv.item_code = ?
           OR inv.item_id = ?
        ORDER BY CASE WHEN inv.item_code = ? THEN 0 ELSE 1 END
        LIMIT 1
      `,
      [requestedId, requestedId, requestedId]
    );
    const resolvedItemCode = Number(resolvedRow?.item_code || requestedId);

    const [[itemInfo]] = await conn.execute(
      `SELECT
         inv.category_id,
         inv.sub_category,
         inv.profit,
         inv.non_member_profit,
         inv.food_pr_charges,
         inv.pr_charges,
         inv.item_name,
         EXISTS (
           SELECT 1
           FROM xxafmc_cocktails_mocktails_details recipe
           WHERE recipe.inventory_item_code = inv.item_code
           LIMIT 1
         ) AS has_recipe
       FROM xxafmc_inventory inv
       WHERE inv.item_code = ?`,
      [resolvedItemCode]
    );

    if (!itemInfo) throw new Error("Item not found");

    const isCocktailOrMocktail = isCocktailOrMocktailInfo(itemInfo);
    const isNonAlcoholicLiquorItem =
      Number(itemInfo.category_id) === 10 && isExcludedLiquorSubcategory(itemInfo.sub_category);
    const isNonMember = usesNonMemberPricing({ roleId, loginType });
    const selectedProfit = isNonAlcoholicLiquorItem
      ? 0
      : isNonMember
        ? Number(itemInfo.non_member_profit || 0)
        : Number(itemInfo.profit || 0);
    const selectedCharges = isNonAlcoholicLiquorItem
      ? 0
      : isNonMember
        ? Number(itemInfo.pr_charges || 0)
        : Number(itemInfo.food_pr_charges || 0);

    if (isCocktailOrMocktail) {
      await ensureCustomizationTable(conn);
    }

    await conn.beginTransaction();

    // -------------------------------
    // GET PEG MULTIPLIER FOR TYPE
    // -------------------------------
    const pegMultiplier = getPegMultiplierForType(type);
    const requestedUnits = normalizedQuantity * pegMultiplier;

    // -------------------------------
    // CHECK EXISTING CART ITEM
    // -------------------------------
    const selectedType = String(type || "").trim();
    const cartDescription = selectedType || "NA";
    // typeKey is the canonical, always-non-blank value written to the TYPE
    // column and used for every existing-row lookup (paid + free). Using the
    // same key everywhere (instead of raw selectedType in some places and
    // "" / "NA" defaults in others) is what keeps add/update/delete from
    // creating duplicate rows for the same logical item+type.
    const typeKey = normalizeCartTypeKey(selectedType);

    const existingSql = `SELECT cart_id, quantity FROM xxafmc_cart_items
       WHERE user_id = ? AND item_id = ? AND price != 0 AND UPPER(TYPE) = UPPER(?)`;
    const existingParams = [userId, resolvedItemCode, typeKey];
    const [existing] = await conn.execute(existingSql, existingParams);

    const totalQuantityAfterUpdate = existing.length > 0
      ? existing[0].quantity + normalizedQuantity
      : normalizedQuantity;
    const totalUnitsAfterUpdate = totalQuantityAfterUpdate * pegMultiplier;

    // -------------------------------
    // FETCH OFFER FIRST
    // -------------------------------
    const [offers] = await conn.execute(
      `SELECT * FROM xxafmc_offers
       WHERE item_code = ?
        AND UPPER(IFNULL(STATUS, '')) <> 'INACTIVE'
       AND (
         (END_DATE IS NULL AND CURDATE() >= DATE(OFFER_DATE))
         OR (CURDATE() BETWEEN DATE(OFFER_DATE) AND END_DATE)
       )
       LIMIT 1`,
      [resolvedItemCode]
    );

    let freeItemCode = null;
    let totalFreeUnits = 0;
    let offerExists = false;

    if (offers.length > 0) {
      const offer = offers[0];
      offerExists = true;
      const offerQty = offer.OFFER_QUANTITY;
      freeItemCode = offer.FREE_ITEM_CODE;
      const freeItemQty = offer.FREE_ITEM_QUANTITY;

      // Calculate free items in UNITS
      totalFreeUnits = Math.floor(totalUnitsAfterUpdate / offerQty) * freeItemQty;

      // Validate free item exists
      if (totalFreeUnits > 0) {
        const [[freeItemInfo]] = await conn.execute(
          `SELECT category_id FROM xxafmc_inventory WHERE item_code = ?`,
          [freeItemCode]
        );
        if (!freeItemInfo) {
          throw createValidationError(`Free item (${freeItemCode}) not found in inventory`);
        }
      }
    }

    // -------------------------------
    // VALIDATE STOCK (in UNITS)
    // -------------------------------
    const reservedQty = await getOrderReservedQuantity(conn, resolvedItemCode);
    const existingCartQty = isCocktailOrMocktail ? 0 : await getCartPegWeightedQuantity(conn, userId, resolvedItemCode);
    const ingredientConsumptionQty = isCocktailOrMocktail ? 0 : await getCartIngredientConsumption(conn, userId, resolvedItemCode);

    let stockQty;
    if (!isCocktailOrMocktail) {
      stockQty = await getStockQuantity(conn, resolvedItemCode, itemInfo.category_id);
    }

    // Calculate total units needed (main + free if same item)
    // NOTE: totalFreeUnits (computed above) is the FULL free-item total after
    // this update, not just the incremental amount being added. existingCartQty
    // (via getCartPegWeightedQuantity) already includes whatever free units of
    // this item are already sitting in the cart, so adding the full new total
    // on top would double-count the portion that already existed. Only the
    // DELTA of free units — the newly-earned free stock — should be added here.
    let totalUnitsNeeded = requestedUnits;
    let existingFreeUnitsForType = 0;
    if (offerExists && freeItemCode === resolvedItemCode && totalFreeUnits > 0) {
      const [existingFreeForDelta] = await conn.execute(
        `SELECT quantity FROM xxafmc_cart_items
         WHERE user_id = ? AND item_id = ? AND price = 0 AND UPPER(TYPE) = UPPER(?) AND parent_code IS NULL`,
        [userId, resolvedItemCode, typeKey]
      );
      existingFreeUnitsForType = existingFreeForDelta.length > 0 ? Number(existingFreeForDelta[0].quantity || 0) : 0;

      // Same item: add only the newly-earned free units, not the running total
      totalUnitsNeeded += Math.max(0, totalFreeUnits - existingFreeUnitsForType);
    }

    // Stock validation for main item (in UNITS)
    if (!isCocktailOrMocktail && existingCartQty + totalUnitsNeeded + reservedQty + ingredientConsumptionQty > stockQty) {
      const availableQty = Math.max(0, stockQty - reservedQty - existingCartQty - ingredientConsumptionQty);
      const effectiveAvailableQty = getEffectiveAvailableQuantityForType(availableQty, type);
      throw createValidationError(`Out of stock. Available quantity: ${effectiveAvailableQty}`);
    }

    // Validate free item stock if different item (in UNITS)
    if (offerExists && totalFreeUnits > 0 && freeItemCode !== resolvedItemCode) {
      const [[freeItemInfo]] = await conn.execute(
        `SELECT category_id FROM xxafmc_inventory WHERE item_code = ?`,
        [freeItemCode]
      );
      
      const freeStockQty = await getStockQuantity(conn, freeItemCode, freeItemInfo.category_id);
      const freeReservedQty = await getOrderReservedQuantity(conn, freeItemCode);
      
      // Get existing free items for this parent (in UNITS)
      const [existingFree] = await conn.execute(
        `SELECT quantity FROM xxafmc_cart_items
         WHERE user_id = ? AND item_id = ? AND price = 0 AND parent_code = ?`,
        [userId, freeItemCode, resolvedItemCode]
      );
      const existingFreeUnits = existingFree.length > 0 ? Number(existingFree[0].quantity) : 0;

      // Get all existing free items of this type (in UNITS)
      const [allFree] = await conn.execute(
        `SELECT SUM(quantity) as total_qty FROM xxafmc_cart_items
         WHERE user_id = ? AND item_id = ? AND price = 0`,
        [userId, freeItemCode]
      );
      const allFreeUnits = Number(allFree[0]?.total_qty || 0);

      const futureFreeUnits = allFreeUnits - existingFreeUnits + totalFreeUnits;

      if (futureFreeUnits + freeReservedQty > freeStockQty) {
        const availableFreeQty = Math.max(0, freeStockQty - freeReservedQty - (allFreeUnits - existingFreeUnits));
        throw createValidationError(
          `Out of stock for free item (${freeItemCode}). Available quantity: ${availableFreeQty} units`
        );
      }
    }

    // -------------------------------
    // If cocktail, get ingredients
    // -------------------------------
    let ingredientsToUse;
    if (customIngredients && customIngredients.length > 0) {
      ingredientsToUse = await enrichIngredientsWithStock(conn, customIngredients, normalizedQuantity);
    } else {
      ingredientsToUse = await getDefaultCocktailIngredientRows(conn, resolvedItemCode, loginType, normalizedQuantity, roleId);
    }

    // -------------------------------
    // INSERT/UPDATE MAIN CART ITEM
    // -------------------------------
    let newQty = normalizedQuantity;
    let insertId = null;

    if (existing.length > 0) {
      newQty = existing[0].quantity + normalizedQuantity;
      await conn.execute(
        `UPDATE xxafmc_cart_items
         SET quantity = ?, total = price * ?
         WHERE cart_id = ?`,
        [newQty, newQty, existing[0].cart_id]
      );
      insertId = existing[0].cart_id;
    } else {
      const [insertResult] = await conn.execute(
        `INSERT INTO xxafmc_cart_items
        (user_id, item_id, quantity, price, total, description, profit, food_pr_charges, created_by, creation_date, TYPE)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [
          userId,
          resolvedItemCode,
          normalizedQuantity,  // Store as item count for main items
          unit_price,
          unit_price * normalizedQuantity,
          cartDescription,
          selectedProfit,
          selectedCharges,
          userId,
          typeKey
        ]
      );
      insertId = insertResult.insertId;
      
      if (isCocktailOrMocktail) {
        const normalized = await normalizeCustomizationUpdates(conn, ingredientsToUse, normalizedQuantity);
        await replaceCartCustomization(conn, insertId, normalized);

        const customizedUnitPrice = Number(
          normalized.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0).toFixed(2)
        ) || Number(unit_price || 0);

        await conn.execute(
          `UPDATE xxafmc_cart_items SET price = ?, total = ? * quantity WHERE cart_id = ?`,
          [customizedUnitPrice, customizedUnitPrice, insertId]
        );
      }
    }

    // -------------------------------
    // ADD FREE ITEMS (Store in UNITS only)
    // -------------------------------
    if (offerExists && totalFreeUnits > 0) {
      if (freeItemCode === resolvedItemCode) {
        // SAME ITEM: Add free items as separate entry with price=0
        // Store quantity in UNITS (not items)
        const [existingFreeSame] = await conn.execute(
          `SELECT cart_id, quantity FROM xxafmc_cart_items
           WHERE user_id = ? AND item_id = ? AND price = 0 AND UPPER(TYPE) = UPPER(?) AND parent_code IS NULL`,
          [userId, resolvedItemCode, typeKey]
        );

        if (existingFreeSame.length > 0) {
          // totalFreeUnits is already the correct FULL total after this update
          // (derived from totalUnitsAfterUpdate, which is main qty after update).
          // REPLACE the stored value rather than adding to it, matching the
          // DIFFERENT-ITEM branch below (line ~1025) — adding here was
          // compounding the free quantity upward on every single increment.
          await conn.execute(
            `UPDATE xxafmc_cart_items
             SET quantity = ?
             WHERE cart_id = ?`,
            [totalFreeUnits, existingFreeSame[0].cart_id]  // Store in UNITS (replace, not add)
          );
        } else {
          await conn.execute(
            `INSERT INTO xxafmc_cart_items
            (user_id, item_id, quantity, price, total, description, created_by, creation_date, TYPE)
            VALUES (?, ?, ?, 0, 0, ?, ?, NOW(), ?)`,
            [
              userId,
              resolvedItemCode,
              totalFreeUnits,  // Store free quantity in UNITS
              "Free Item (BOGO)",
              userId,
              typeKey
            ]
          );
        }
      } else {
        // DIFFERENT ITEM: Store free quantity in UNITS
        const [freeExisting] = await conn.execute(
          `SELECT cart_id FROM xxafmc_cart_items
           WHERE user_id = ? AND item_id = ? AND price = 0 AND parent_code = ? AND UPPER(TYPE) = UPPER(?)`,
          [userId, freeItemCode, resolvedItemCode, typeKey]
        );

        if (freeExisting.length > 0) {
          await conn.execute(
            `UPDATE xxafmc_cart_items
             SET quantity = ?
             WHERE cart_id = ?`,
            [totalFreeUnits, freeExisting[0].cart_id]  // Store in UNITS
          );
        } else {
          await conn.execute(
            `INSERT INTO xxafmc_cart_items
            (user_id, item_id, quantity, price, total, description, created_by, creation_date, parent_code, TYPE)
            VALUES (?, ?, ?, 0, 0, ?, ?, NOW(), ?, ?)`,
            [
              userId,
              freeItemCode,
              totalFreeUnits,  // Store free quantity in UNITS
              "Free Item (BOGO)",
              userId,
              resolvedItemCode,
              typeKey
            ]
          );
        }
      }
    }

    await conn.commit();

    // -------------------------------
    // RESPONSE
    // -------------------------------
    const response = {
      message: offerExists && totalFreeUnits > 0 ? "Item + free item added successfully" : "Item added successfully",
      insertId,
      isCocktailItem: isCocktailOrMocktail,
      // Include the quantity in units for frontend to display correctly
      addedQuantity: quantity,
      addedUnits: requestedUnits
    };

    if (offerExists && totalFreeUnits > 0) {
      response.freeItem = {
        item_id: freeItemCode,
        quantity: totalFreeUnits  // ✅ Send free quantity in UNITS only
      };
    }

    return response;

  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const getCartItemsByUser = async (userId) => {

  await ensureCustomizationTable(db);
  const sql = `
    SELECT
      c.cart_id,
      xi.item_code,
      c.item_id,
      xi.item_name,
      xi.image,
      c.price,
      xi.unit_price AS inventory_price,
      IFNULL(xi.stock_quantity, 0) AS inventory_stock_quantity,
      c.description,
      c.uom,
      c.quantity,
      c.total,
      c.created_by,
      c.creation_date,
      c.last_updated_by,
      c.last_updated_date,
      c.parent_code,
      xi.category_id,
      c.subcategory,
      c.type,
      xi.sub_category AS inventory_subcategory,
      EXISTS (
        SELECT 1
        FROM xxafmc_cocktails_mocktails_details recipe
        WHERE recipe.inventory_item_code = c.item_id
        LIMIT 1
      ) AS has_recipe,
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


  const itemCodes = [...new Set(
    rows.map((r) => Number(r.item_code)).filter((code) => Number.isFinite(code) && code > 0)
  )];

  const reservedMap = await getReservedTotalsQuantities(db, itemCodes);
  const ingredientConsumptionMap = await getCartIngredientConsumptionMap(db, userId, itemCodes);

  const cocktailCartIds = rows
    .filter((row) => isCocktailOrMocktailInfo({
      category_id: row.category_id,
      sub_category: row.inventory_subcategory,
      has_recipe: row.has_recipe,
    }) && Number(row.price ?? row.inventory_price ?? 0) !== 0)
    .map((row) => Number(row.cart_id))
    .filter((id) => Number.isFinite(id) && id > 0);

  const cocktailStatusMap = new Map();
  if (cocktailCartIds.length > 0) {
    const placeholders = [...new Set(cocktailCartIds)].map(() => "?").join(",");
    const [customRows] = await db.execute(
      `
        SELECT
          cc.cart_id,
          cc.ingredient_item_code,
          cc.quantity AS ingredient_quantity,
          c.quantity AS cart_quantity
        FROM ${CUSTOMIZATION_TABLE} cc
        INNER JOIN xxafmc_cart_items c
          ON c.cart_id = cc.cart_id
        WHERE cc.cart_id IN (${placeholders})
      `,
      [...new Set(cocktailCartIds)]
    );

    const ingredientCodes = [...new Set(customRows.map((r) => Number(r.ingredient_item_code)).filter((code) => Number.isFinite(code) && code > 0))];
    const stockMap = await getIngredientStockQuantities(db, ingredientCodes);
    const reservedMap = await getIngredientReservedQuantities(db, ingredientCodes);

    const byCart = customRows.reduce((acc, row) => {
      const cartId = Number(row.cart_id);
      if (!acc.has(cartId)) acc.set(cartId, []);
      acc.get(cartId).push({
        itemCode: Number(row.ingredient_item_code),
        ingredientQuantity: Number(row.ingredient_quantity || 0),
        cartQuantity: Number(row.cart_quantity || 1),
      });
      return acc;
    }, new Map());

    for (const [cartId, ingredients] of byCart.entries()) {
      const hasIngredients = ingredients.length > 0;
      const enoughStock = hasIngredients && ingredients.every((item) => {
        const stockQuantity = Number(stockMap[String(item.itemCode)] || 0);
        const reservedQuantity = Number(reservedMap[String(item.itemCode)] || 0);
        const availableQuantity = Math.max(0, stockQuantity - reservedQuantity);
        const requiredQuantity = Number(item.ingredientQuantity || 0) * Number(item.cartQuantity || 1);
        return availableQuantity >= requiredQuantity;
      });
      cocktailStatusMap.set(cartId, hasIngredients ? (enoughStock ? "In Stock" : "Out Of Stock") : "Unknown");
    }
  }

  return rows.map((row) => {
    const quantity = Number(row.quantity || 0);

    const rawPrice = row.price ?? row.inventory_price;
    const price = Number(rawPrice || 0);
    const subcategory = Number(row.inventory_subcategory || 0);
    const isFreeItem = price === 0;

    const isCocktailItem = isCocktailOrMocktailInfo({
      category_id: row.category_id,
      sub_category: row.inventory_subcategory,
      has_recipe: row.has_recipe,
    });

    const canEdit = isCocktailItem && !isFreeItem;

    const categoryId = Number(row.category_id || 0);
    const inventoryStock = Number(row.inventory_stock_quantity || 0);
    const stockOutStock = Number(row.stock_quantity || 0);
    const effectiveStockQty = categoryId === 10
      ? stockOutStock
      : Math.max(inventoryStock, stockOutStock);
    const reservedQty = Number(reservedMap.get(String(row.item_code)) || 0);
    const ingredientConsumptionQty = Number(ingredientConsumptionMap[String(row.item_id)] || 0);
    const availableQuantity = isCocktailItem
      ? null
      : Math.max(0, effectiveStockQty - reservedQty - ingredientConsumptionQty);

    const stockStatus = isCocktailItem
      ? (cocktailStatusMap.get(Number(row.cart_id)) || "Unknown")
      : availableQuantity === 0
        ? "Out Of Stock"
        : "In Stock";

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
      categoryId,
      stockQuantity: effectiveStockQty,
      availableQuantity,
      stockStatus,
      isFreeItem,
      canEdit,
      type: row.description || row.type || null,
      hasRecipe: Number(row.has_recipe || 0) > 0,
    };
  });
};

const updateCartItemQuantity = async (cartId, userId, quantity) => {
  const conn = await db.getConnection();

  if (Number.isNaN(cartId)) {
    throw new Error("Invalid cart ID");
  }

  try {
    await ensureCustomizationTable(conn);
    await conn.beginTransaction();

    if (quantity <= 0) {
      return await deleteCartItem(cartId, userId);
    }

    // Get current item details
    const [current] = await conn.execute(
      `SELECT
         c.item_id,
         c.quantity,
         c.description,
         c.type,
         xi.category_id,
         xi.sub_category,
         EXISTS (
           SELECT 1
           FROM xxafmc_cocktails_mocktails_details recipe
           WHERE recipe.inventory_item_code = c.item_id
           LIMIT 1
         ) AS has_recipe
       FROM xxafmc_cart_items c
       LEFT JOIN xxafmc_inventory xi ON c.item_id = xi.item_code
       WHERE c.cart_id = ? AND c.user_id = ?`,
      [cartId, userId]
    );

    if (current.length === 0) {
      return { affectedRows: 0 };
    }

    const itemId = current[0].item_id;
    const isCocktailOrMocktail = isCocktailOrMocktailInfo(current[0]);
    const pegMultiplier = getPegMultiplierForType(current[0].type);
    // Must match the exact same normalization addCartItem used when it wrote
    // this row's TYPE column, or the free-row lookups below silently miss
    // the existing row and insert a duplicate instead of updating it.
    const selectedType = normalizeCartTypeKey(current[0].type);

    // -------------------------------
    // 1. FETCH OFFER FIRST
    // -------------------------------
    const [offers] = await conn.execute(
      `SELECT * FROM xxafmc_offers
       WHERE ITEM_CODE = ?
        AND UPPER(IFNULL(STATUS, '')) <> 'INACTIVE'
       AND (
         (END_DATE IS NULL AND CURDATE() >= DATE(OFFER_DATE))
         OR (CURDATE() BETWEEN DATE(OFFER_DATE) AND END_DATE)
       )
       LIMIT 1`,
      [itemId]
    );

    let freeItemCode = null;
    let totalFreeUnits = 0;
    let offerExists = false;

    if (offers.length > 0) {
      const offer = offers[0];
      offerExists = true;
      const offerQty = offer.OFFER_QUANTITY;
      freeItemCode = offer.FREE_ITEM_CODE;
      const freeItemQty = offer.FREE_ITEM_QUANTITY;

      // Calculate free items based on quantity in UNITS
      const totalUnits = quantity * pegMultiplier;
      totalFreeUnits = Math.floor(totalUnits / offerQty) * freeItemQty;
    }

    // -------------------------------
    // 2. VALIDATE MAIN ITEM STOCK ON QUANTITY CHANGE
    // -------------------------------
    if (!isCocktailOrMocktail) {
      const stockQty = await getStockQuantity(conn, itemId, current[0].category_id);
      const reservedQty = await getOrderReservedQuantity(conn, itemId);
      const otherWeightedQty = await getCartPegWeightedQuantity(conn, userId, itemId, cartId);
      const ingredientConsumptionQty = await getCartIngredientConsumption(conn, userId, itemId, cartId);

      // Calculate total units needed (main + free if same item)
      // NOTE: otherWeightedQty (via getCartPegWeightedQuantity, excluding only
      // this main row's cartId) already includes the OLD free-item row's
      // weighted units, since that row has its own separate cart_id. totalFreeUnits
      // is the FULL new free total after this update, not a delta — so only the
      // newly-earned portion (delta over what's already stored) should be added,
      // or the old free amount gets counted twice.
      let requiredQty = quantity * pegMultiplier;
      if (offerExists && freeItemCode === itemId) {
        const [existingFreeForDelta] = await conn.execute(
          `SELECT quantity FROM xxafmc_cart_items
           WHERE user_id = ? AND item_id = ? AND price = 0 AND UPPER(TYPE) = UPPER(?) AND parent_code IS NULL`,
          [userId, itemId, selectedType]
        );
        const existingFreeUnitsForType = existingFreeForDelta.length > 0 ? Number(existingFreeForDelta[0].quantity || 0) : 0;
        // Same item offer: add only the newly-earned free units, not the running total
        requiredQty += Math.max(0, totalFreeUnits - existingFreeUnitsForType);
      }

      if (requiredQty + otherWeightedQty + reservedQty + ingredientConsumptionQty > stockQty) {
        const availableQty = Math.max(0, stockQty - reservedQty - otherWeightedQty - ingredientConsumptionQty);
        const effectiveAvailableQty = getEffectiveAvailableQuantityForType(availableQty, current[0]);
        throw createValidationError(`Out of stock. Available quantity: ${effectiveAvailableQty}`);
      }
    }

    // -------------------------------
    // 3. VALIDATE CUSTOMIZATION STOCK (for cocktails)
    // -------------------------------
    if (isCocktailOrMocktail) {
      const customization = await getCartCustomization(cartId, userId);

      const [[parentItem]] = await conn.execute(
        `SELECT item_name
         FROM xxafmc_inventory
         WHERE item_code = ?`,
        [itemId]
      );

      const ingredientsWithParentName = customization.ingredients.map((ingredient) => ({
        ...ingredient,
        parentItemName: parentItem?.item_name || itemId
      }));

      if (ingredientsWithParentName.length > 0) {
        await validateCustomizationStock(conn, ingredientsWithParentName, quantity, userId, cartId);
      }
    }

    // -------------------------------
    // 4. UPDATE MAIN ITEM QUANTITY
    // -------------------------------
    await conn.execute(
      `UPDATE xxafmc_cart_items
       SET quantity = ?, total = price * ?
       WHERE cart_id = ? AND user_id = ?`,
      [quantity, quantity, cartId, userId]
    );

    // -------------------------------
    // 5. HANDLE FREE ITEMS
    // -------------------------------
    if (offerExists) {
      // Validate free item stock for different item offers
      if (freeItemCode !== itemId && totalFreeUnits > 0) {
        const [[freeItemInfo]] = await conn.execute(
          `SELECT category_id FROM xxafmc_inventory WHERE item_code = ?`,
          [freeItemCode]
        );
        
        if (!freeItemInfo) {
          throw createValidationError(`Free item (${freeItemCode}) not found in inventory`);
        }

        const freeStockQty = await getStockQuantity(conn, freeItemCode, freeItemInfo.category_id);
        const freeReservedQty = await getOrderReservedQuantity(conn, freeItemCode);
        
        // Get existing free items for this parent
        const [existingFreeForParent] = await conn.execute(
          `SELECT quantity FROM xxafmc_cart_items
           WHERE user_id = ? AND item_id = ? AND price = 0 AND parent_code = ?`,
          [userId, freeItemCode, itemId]
        );
        const existingFreeForParentUnits = existingFreeForParent.length > 0 ? Number(existingFreeForParent[0].quantity) : 0;

        // Get all existing free items of this type
        const [allFree] = await conn.execute(
          `SELECT SUM(quantity) as total_qty FROM xxafmc_cart_items
           WHERE user_id = ? AND item_id = ? AND price = 0`,
          [userId, freeItemCode]
        );
        const allFreeUnits = Number(allFree[0]?.total_qty || 0);

        const futureFreeQty = allFreeUnits - existingFreeForParentUnits + totalFreeUnits;

        if (futureFreeQty + freeReservedQty > freeStockQty) {
          const availableFreeQty = Math.max(0, freeStockQty - freeReservedQty - (allFreeUnits - existingFreeForParentUnits));
          throw createValidationError(`Out of stock for free item. Available quantity: ${availableFreeQty}`);
        }
      }

      // Handle same item offer
      if (freeItemCode === itemId) {
        // Get existing free entry for this item (price = 0, same item, same type)
        const [existingFreeSame] = await conn.execute(
          `SELECT cart_id, quantity FROM xxafmc_cart_items
           WHERE user_id = ? AND item_id = ? AND price = 0 AND UPPER(TYPE) = UPPER(?) AND parent_code IS NULL`,
          [userId, itemId, selectedType]
        );

        if (totalFreeUnits > 0) {
          if (existingFreeSame.length > 0) {
            // Update existing free entry
            await conn.execute(
              `UPDATE xxafmc_cart_items 
               SET quantity = ? 
               WHERE cart_id = ?`,
              [totalFreeUnits, existingFreeSame[0].cart_id]
            );
          } else {
            // Insert new free entry
            await conn.execute(
              `INSERT INTO xxafmc_cart_items
              (user_id, item_id, quantity, price, total, description, created_by, creation_date, TYPE)
              VALUES (?, ?, ?, 0, 0, ?, ?, NOW(), ?)`,
              [
                userId,
                itemId,
                totalFreeUnits,
                "Free Item (BOGO)",
                userId,
                selectedType
              ]
            );
          }
        } else {
          // Delete free entry if no free items
          await conn.execute(
            `DELETE FROM xxafmc_cart_items
             WHERE user_id = ? AND item_id = ? AND price = 0 AND UPPER(TYPE) = UPPER(?) AND parent_code IS NULL`,
            [userId, itemId, selectedType]
          );
        }
      } else {
        // Handle different item offer
        if (totalFreeUnits > 0) {
          // Check if free item already exists for this parent (scoped to
          // this parent's specific peg type, same as the same-item branch
          // above — otherwise a Small and a Large row of the same parent
          // item would fight over one shared free row).
          const [freeExisting] = await conn.execute(
            `SELECT cart_id FROM xxafmc_cart_items
             WHERE user_id = ? AND item_id = ? AND price = 0 AND parent_code = ? AND UPPER(TYPE) = UPPER(?)`,
            [userId, freeItemCode, itemId, selectedType]
          );

          if (freeExisting.length > 0) {
            // Update existing free entry
            await conn.execute(
              `UPDATE xxafmc_cart_items 
               SET quantity = ? 
               WHERE cart_id = ?`,
              [totalFreeUnits, freeExisting[0].cart_id]
            );
          } else {
            // Insert new free entry
            await conn.execute(
              `INSERT INTO xxafmc_cart_items
              (user_id, item_id, quantity, price, total, description, created_by, creation_date, parent_code, TYPE)
              VALUES (?, ?, ?, 0, 0, ?, ?, NOW(), ?, ?)`,
              [
                userId,
                freeItemCode,
                totalFreeUnits,
                "Free Item (BOGO)",
                userId,
                itemId,
                selectedType
              ]
            );
          }
        } else {
          // Delete free item if quantity is 0 (scoped to this parent's type,
          // so clearing the Large row's free item doesn't also wipe out a
          // still-valid free row earned by the Small row of the same item).
          await conn.execute(
            `DELETE FROM xxafmc_cart_items
             WHERE user_id = ? AND item_id = ? AND price = 0 AND parent_code = ? AND UPPER(TYPE) = UPPER(?)`,
            [userId, freeItemCode, itemId, selectedType]
          );
        }
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
    await ensureCustomizationTable(conn);
    await conn.beginTransaction();

    // Get item details before deleting
    const [item] = await conn.execute(
      `SELECT item_id, price, type FROM xxafmc_cart_items WHERE cart_id = ? AND user_id = ?`,
      [cartId, userId]
    );

    if (item.length === 0) {
      return { affectedRows: 0 };
    }

    const itemId = item[0].item_id;
    const price = item[0].price;
    // Same normalization as addCartItem/updateCartItemQuantity — must match
    // exactly, or the same-item-offer branch below misses the free row.
    const type = normalizeCartTypeKey(item[0].type);

    // Delete customization entries
    await conn.execute(`DELETE FROM ${CUSTOMIZATION_TABLE} WHERE cart_id = ?`, [cartId]);

    // Delete the item
    const [result] = await conn.execute(
      `DELETE FROM xxafmc_cart_items WHERE cart_id = ? AND user_id = ?`,
      [cartId, userId]
    );

    // If it's a main item (price != 0), delete associated free items
    if (price !== 0) {
      const [offers] = await conn.execute(
        `SELECT FREE_ITEM_CODE FROM xxafmc_offers
         WHERE ITEM_CODE = ?
         AND UPPER(IFNULL(STATUS, '')) <> 'INACTIVE'
         AND (
           (END_DATE IS NULL AND CURDATE() >= DATE(OFFER_DATE))
           OR (CURDATE() BETWEEN DATE(OFFER_DATE) AND END_DATE)
         )
         LIMIT 1`,
        [itemId]
      );

      if (offers.length > 0) {
        const freeItemCode = offers[0].FREE_ITEM_CODE;
        
        // Check if it's a same-item offer or different-item offer
        if (freeItemCode === itemId) {
          // SAME ITEM OFFER: Free item has price = 0, same item_id, same type, no parent_code
          await conn.execute(
            `DELETE FROM xxafmc_cart_items
             WHERE user_id = ? AND item_id = ? AND price = 0 AND UPPER(TYPE) = UPPER(?) AND parent_code IS NULL`,
            [userId, itemId, type]
          );
        } else {
          // DIFFERENT ITEM OFFER: Free item has price = 0, parent_code = itemId.
          // Scope by type too — otherwise deleting just the Small line would
          // also wipe out the free row earned by a separate Large line of
          // the same parent item still sitting in the cart.
          await conn.execute(
            `DELETE FROM xxafmc_cart_items
             WHERE user_id = ? AND parent_code = ? AND price = 0 AND UPPER(TYPE) = UPPER(?)`,
            [userId, itemId, type]
          );
        }
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
    `SELECT
       c.cart_id,
       c.item_id,
       c.quantity,
       xi.category_id,
       xi.sub_category,
       EXISTS (
         SELECT 1
         FROM xxafmc_cocktails_mocktails_details recipe
         WHERE recipe.inventory_item_code = c.item_id
         LIMIT 1
       ) AS has_recipe
     FROM xxafmc_cart_items c
     LEFT JOIN xxafmc_inventory xi ON c.item_id = xi.item_code
     WHERE c.cart_id = ?
       AND c.user_id = ?
       AND c.price != 0
     LIMIT 1`,
    [cartId, userId]
  );
  // console.log("row",rows)
  return rows[0] || null;
};

const getCartItemByCode = async (userId, itemCode) => {
  const [rows] = await db.execute(
    `SELECT
       c.cart_id,
       c.item_id,
       c.quantity,
       xi.category_id,
       xi.sub_category,
       EXISTS (
         SELECT 1
         FROM xxafmc_cocktails_mocktails_details recipe
         WHERE recipe.inventory_item_code = c.item_id
         LIMIT 1
       ) AS has_recipe
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

    const normalizedSubCategory = Number(subCategory);

    const allowedSubCategories =
      normalizedSubCategory === 14
        ? [6, 9, 4, 18]
        : normalizedSubCategory === 15
          ? null
          : [];

    if (allowedSubCategories && allowedSubCategories.length === 0) {
      return [];
    }

    const subCategoryCondition = normalizedSubCategory === 15
      ? "xi.sub_category NOT IN (1, 6, 9, 4, 14, 15, 7, 10, 3, 1310, 18)"
      : "xi.sub_category IN (?, ?, ?, ?)";

    const query = `
      SELECT
        xi.item_name AS d,
        xi.item_code AS r,
        GREATEST(
          IFNULL(stock_summary.stock_quantity, 0)
            - IFNULL(reserved_summary.reserved_quantity, 0),
          0
        ) AS stockQuantity,
        xi.unit_price AS unitPrice
      FROM xxafmc_inventory xi
      LEFT JOIN (
        SELECT item_code, IFNULL(SUM(stock_quantity), 0) AS stock_quantity
        FROM xxafmc_stock_out
        GROUP BY item_code
      ) stock_summary
        ON stock_summary.item_code = xi.item_code
      LEFT JOIN (
        SELECT item_code, IFNULL(reserved_qty, 0) AS reserved_quantity
        FROM xxafmc_stock_reservation_totals
      ) reserved_summary
        ON reserved_summary.item_code = xi.item_code
      WHERE ${subCategoryCondition}
        AND (xi.\`A/C_UNIT\` IS NULL OR UPPER(TRIM(xi.\`A/C_UNIT\`)) <> 'GLASS')
        AND xi.STATUS = 'ACTIVE'  -- ADD THIS - Only show active items
        AND GREATEST(
          GREATEST(IFNULL(xi.stock_quantity, 0), IFNULL(stock_summary.stock_quantity, 0))
            - IFNULL(reserved_summary.reserved_quantity, 0),
          0
        ) > 0
      ORDER BY xi.item_name
    `;

    const [rows] = await connection.query(query, allowedSubCategories || []);

    return rows;

  } catch (error) {
    console.error("Model Error:", error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

const getReservedQuantitiesForOrder = async (connection, itemCodes, excludeOrderNumber) => {
  const normalizedOrderNumber = Number(excludeOrderNumber);
  if (!Number.isFinite(normalizedOrderNumber) || normalizedOrderNumber <= 0) {
    return {};
  }

  const normalizedCodes = [...new Set((Array.isArray(itemCodes) ? itemCodes : [])
    .map((code) => Number(code))
    .filter((code) => Number.isFinite(code) && code > 0))];

  if (normalizedCodes.length === 0) {
    return {};
  }

  const placeholders = normalizedCodes.map(() => "?").join(",");
  const [regularRows] = await connection.query(
    `
      SELECT item_id AS itemCode, IFNULL(SUM(quantity), 0) AS quantity
      FROM xxafmc_order_details
      WHERE order_id = ?
        AND item_id IN (${placeholders})
        AND (order_status IS NULL OR TRIM(order_status) = '')
      GROUP BY item_id
    `,
    [normalizedOrderNumber, ...normalizedCodes]
  );

  const [ingredientRows] = await connection.query(
    `
      SELECT
        c.item_code AS itemCode,
        IFNULL(SUM(IFNULL(c.pegs, 0) * IFNULL(od.quantity, 0)), 0) AS quantity
      FROM (
        SELECT order_number, inventory_item_code, item_code, pegs
        FROM xxafmc_custom_cocktails_mocktails_details
        WHERE order_number = ?
        UNION ALL
        SELECT order_number, inventory_item_code, item_code, pegs
        FROM xxafmc_custom_cocktails_mocktails_details_dummy
        WHERE order_number = ?
      ) c
      INNER JOIN xxafmc_order_details od
        ON od.order_id = c.order_number
        AND od.item_id = c.inventory_item_code
        AND (od.order_status IS NULL OR TRIM(od.order_status) = '')
      WHERE c.item_code IN (${placeholders})
      GROUP BY c.item_code
    `,
    [normalizedOrderNumber, normalizedOrderNumber, ...normalizedCodes]
  );

  return [...regularRows, ...ingredientRows].reduce((acc, row) => {
    const key = String(row.itemCode);
    acc[key] = Number(acc[key] || 0) + Number(row.quantity || 0);
    return acc;
  }, {});
};

const getIngredientStockMap = async (itemCodes, excludeOrderNumber = null, userId = null, excludeCartId = null, ignoreOwnCart = false) => {
  let connection;

  const normalizedCodes = [...new Set((Array.isArray(itemCodes) ? itemCodes : [])
    .map((code) => Number(code))
    .filter((code) => Number.isFinite(code) && code > 0))];

  if (normalizedCodes.length === 0) {
    return {};
  }

  try {
    connection = await db.getConnection();

    const placeholders = normalizedCodes.map(() => "?").join(",");
    const excludedReservedMap = await getReservedQuantitiesForOrder(
      connection,
      normalizedCodes,
      excludeOrderNumber
    );

    const excludedReservedCase = normalizedCodes.length > 0
      ? `CASE xi.item_code ${normalizedCodes.map(() => "WHEN ? THEN ?").join(" ")} ELSE 0 END`
      : "0";
    const excludedReservedParams = normalizedCodes.flatMap((code) => [
      code,
      Number(excludedReservedMap[String(code)] || 0),
    ]);

    const query = `
      SELECT
        xi.item_code AS itemCode,
       GREATEST(
  IFNULL(stock_summary.stock_quantity, 0)
    - GREATEST(IFNULL(reserved_summary.reserved_quantity, 0) - (${excludedReservedCase}), 0),
  0
) AS stockQuantity
      FROM xxafmc_inventory xi
      LEFT JOIN (
        SELECT item_code, IFNULL(SUM(stock_quantity), 0) AS stock_quantity
        FROM xxafmc_stock_out
        GROUP BY item_code
      ) stock_summary
        ON stock_summary.item_code = xi.item_code
      LEFT JOIN (
        SELECT item_code, IFNULL(reserved_qty, 0) AS reserved_quantity
        FROM xxafmc_stock_reservation_totals
      ) reserved_summary
        ON reserved_summary.item_code = xi.item_code
      WHERE xi.item_code IN (${placeholders})
    `;

    const [rows] = await connection.query(query, [...excludedReservedParams, ...normalizedCodes]);

    const baseStock = rows.reduce((acc, row) => {
      acc[String(row.itemCode)] = Number(row.stockQuantity || 0);
      return acc;
    }, {});

    if (!userId || ignoreOwnCart) {
      return baseStock;
    }

    const cartConsumptionMap = await getCartConsumptionMap(connection, userId, normalizedCodes, excludeCartId);

    return normalizedCodes.reduce((acc, code) => {
      const key = String(code);
      const consumed = Number(cartConsumptionMap[key] || 0);
      acc[key] = Math.max(0, Number(baseStock[key] || 0) - consumed);
      return acc;
    }, {});
  } catch (error) {
    console.error("Model Error (getIngredientStockMap):", error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

module.exports = {
  addCartItem,
  getCartItemsByUser,
  updateCartItemQuantity,
  deleteCartItem,
  getCartItemById,
  getCartItemByCode,
  getCartCustomization,
  updateCartCustomization,
  createDefaultCustomizationForCart,
  ensureCustomizationTable,
  getLovIngredients,
  getIngredientStockMap,
};