const db = require("../config/db");

const CUSTOMIZATION_TABLE = "xxafmc_cart_customization";

const createValidationError = (message) => {
  const error = new Error(message);
  error.status = 400;
  return error;
};

const getStockQuantity = async (conn, itemCode) => {
  // Two stock sources exist in this schema:
  // - `xxafmc_inventory.stock_quantity` (used by inventory listing/transactions)
  // - `xxafmc_stock_out.stock_quantity` (used for bar/ingredient stock buckets)
  // Prefer inventory.stock_quantity when present, otherwise fall back to stock_out sum.
  const [[invRow]] = await conn.execute(
    `SELECT IFNULL(STOCK_QUANTITY, 0) AS stock FROM xxafmc_inventory WHERE item_code = ? LIMIT 1`,
    [itemCode]
  );

  const inventoryStock = Number(invRow?.stock || 0);
  if (inventoryStock > 0) {
    return inventoryStock;
  }

  const [[stockRow]] = await conn.execute(
    `SELECT IFNULL(SUM(STOCK_QUANTITY), 0) AS stock
     FROM xxafmc_stock_out
     WHERE item_code = ?`,
    [itemCode]
  );

  return Number(stockRow?.stock || 0);
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

const isCocktailOrMocktailInfo = (itemInfo) =>
  Number(itemInfo?.category_id) === 10 && [14, 15].includes(Number(itemInfo?.sub_category));

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

const getIngredientStockQuantity = async (conn, itemCode) => getStockQuantity(conn, itemCode);

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

const getDefaultCocktailIngredientRows = async (conn, parentItemCode, loginType = "") => {
  const normalizedLoginType = String(loginType || "").trim().toUpperCase();
  const [rows] = await conn.execute(
    `
      SELECT
        ITEM_CODE,
        ITEM_NAME,
        PEGS,
        PRICE,
        NON_MEMBER_PRICE
      FROM xxafmc_cocktails_mocktails_details
      WHERE INVENTORY_ITEM_CODE = ?
      ORDER BY COALESCE(MOC_ID, 0), ITEM_NAME
    `,
    [parentItemCode]
  );

  return rows.map((row) => {
    const quantity = Number(row.PEGS || 0);
    const selectedPrice = normalizedLoginType === "NON MEMBER"
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
};

const validateCustomizationStock = async (conn, ingredients, cartQuantity = 1) => {
  console.log("Validating customization stock for ingredients:", ingredients, "with cart quantity:", cartQuantity);
  for (const ingredient of ingredients) {
    const itemCode = Number(ingredient.itemCode);
    const requiredQty = Number(ingredient.quantity || 0) * Number(cartQuantity || 1);
    if (!itemCode || requiredQty <= 0) continue;

    const stockQty = await getIngredientStockQuantity(conn, itemCode);
    const reservedQty = await getOrderReservedQuantity(conn, itemCode);

    if (requiredQty + reservedQty > stockQty) {
      const availableQty = Math.max(0, stockQty - reservedQty);
      // throw createValidationError(`Out of stock for ingredient ${ingredient.itemName || itemCode} in ${ingredient.parentItemName}. Available quantity: ${availableQty}`);
      throw createValidationError(
  `Only ${availableQty} ${ingredient.itemName || itemCode} available for ${ingredient.parentItemName}.`
);
    }
  }
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
  }
};

const createDefaultCustomizationForCart = async (conn, { cartId, parentItemCode, cartQuantity, loginType }) => {
  const ingredients = await getDefaultCocktailIngredientRows(conn, parentItemCode, loginType);
  await validateCustomizationStock(conn, ingredients, cartQuantity);
  await replaceCartCustomization(conn, cartId, ingredients);
  return ingredients;
};

const normalizeCustomizationUpdates = async (conn, updates) => {
  const normalized = (Array.isArray(updates) ? updates : [])
    .map((item) => ({
      itemCode: Number(item?.itemCode ?? item?.ingredient_item_code ?? item?.ingredientItemCode),
      quantity: Number(item?.quantity),
      itemName: item?.itemName ?? item?.ingredientName ?? item?.name,
      unitPrice: item?.unitPrice != null ? Number(item.unitPrice) : null,
    }))
    .filter((item) => Number.isFinite(item.itemCode) && item.itemCode > 0 && Number.isFinite(item.quantity) && item.quantity >= 0);

  const metaMap = await getIngredientMetaRows(conn, normalized.map((item) => item.itemCode));

  return normalized.map((item) => {
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
};

const getIngredientStockQuantities = async (conn, itemCodes) => {
  const normalizedCodes = [...new Set((Array.isArray(itemCodes) ? itemCodes : [])
    .map((code) => Number(code))
    .filter((code) => Number.isFinite(code) && code > 0))];

  if (normalizedCodes.length === 0) return {};

  const placeholders = normalizedCodes.map(() => "?").join(",");
  // Prefer `xxafmc_inventory.stock_quantity` when available, otherwise fall back to `xxafmc_stock_out` sum.
  const [invRows] = await conn.execute(
    `SELECT item_code, IFNULL(stock_quantity, 0) AS stock_quantity
     FROM xxafmc_inventory
     WHERE item_code IN (${placeholders})`,
    normalizedCodes
  );
  const inventoryMap = invRows.reduce((map, row) => {
    map[String(row.item_code)] = Number(row.stock_quantity || 0);
    return map;
  }, {});

  const [stockOutRows] = await conn.execute(
    `SELECT item_code, IFNULL(SUM(stock_quantity), 0) AS stock_quantity
     FROM xxafmc_stock_out
     WHERE item_code IN (${placeholders})
     GROUP BY item_code`,
    normalizedCodes
  );
  const stockOutMap = stockOutRows.reduce((map, row) => {
    map[String(row.item_code)] = Number(row.stock_quantity || 0);
    return map;
  }, {});

  return normalizedCodes.reduce((map, code) => {
    const key = String(code);
    map[key] = Math.max(Number(inventoryMap[key] || 0), Number(stockOutMap[key] || 0));
    return map;
  }, {});
};

const getIngredientReservedQuantities = async (conn, itemCodes) => {
  const normalizedCodes = [...new Set((Array.isArray(itemCodes) ? itemCodes : [])
    .map((code) => Number(code))
    .filter((code) => Number.isFinite(code) && code > 0))];

  if (normalizedCodes.length === 0) return {};

  const placeholders = normalizedCodes.map(() => "?").join(",");
  const [rows] = await conn.execute(
    `SELECT xod.item_id AS item_code, IFNULL(SUM(xod.quantity), 0) AS reserved
     FROM xxafmc_order_details xod
     LEFT JOIN xxafmc_order_header xoh ON xod.order_id = xoh.order_num
     LEFT JOIN xxafmc_invoices xi ON xi.order_num = xod.order_id
     WHERE xod.item_id IN (${placeholders})
       AND xod.order_status IS NULL
       AND xod.price IS NULL
       AND xi.order_num IS NULL
     GROUP BY xod.item_id`,
    normalizedCodes
  );

  return rows.reduce((map, row) => {
    map[String(row.item_code)] = Number(row.reserved || 0);
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
        c.quantity AS cart_quantity
      FROM ${CUSTOMIZATION_TABLE} cc
      INNER JOIN xxafmc_cart_items c
        ON c.cart_id = cc.cart_id
      WHERE cc.cart_id = ?
        AND c.user_id = ?
      ORDER BY cc.id
    `,
    [cartId, userId]
  );

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
    };
  });

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
        SELECT c.cart_id, c.item_id, c.quantity, xi.category_id, xi.sub_category
        FROM xxafmc_cart_items c
        LEFT JOIN xxafmc_inventory xi ON c.item_id = xi.item_code
        WHERE c.cart_id = ?
          AND c.user_id = ?
          AND c.price != 0
        LIMIT 1
      `,
      [cartId, userId]
    );

    const cartItem = cartRows[0];
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

    const ingredients = await normalizeCustomizationUpdates(conn, updates);
    if (ingredients.length === 0) {
      throw createValidationError("At least one valid ingredient is required");
    }

    await validateCustomizationStock(conn, ingredients, cartItem.quantity);
    await replaceCartCustomization(conn, cartId, ingredients);

    const unitPrice = Number(ingredients.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0).toFixed(2));
    await conn.execute(
      `UPDATE xxafmc_cart_items SET price = ?, total = ? * quantity, last_updated_by = ?, last_updated_date = NOW() WHERE cart_id = ? AND user_id = ?`,
      [unitPrice, unitPrice, userId, cartId, userId]
    );

    await conn.commit();
    return {
      cartId: Number(cartId),
      cartItemQuantity: Number(cartItem.quantity || 1),
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
  const { item_id, quantity = 1, unit_price = 0, remarks, loginType, customIngredients } = itemData;

  const conn = await db.getConnection();

  try {
    const [[itemInfo]] = await conn.execute(
      `SELECT category_id, sub_category, food_pr_charges, item_name
         FROM xxafmc_inventory
         WHERE item_code = ?`,
      [item_id]
    );

    if (!itemInfo) throw new Error("Item not found");

    const isCocktailOrMocktail = isCocktailOrMocktailInfo(itemInfo);
    if (isCocktailOrMocktail) {
      await ensureCustomizationTable(conn);
    }

    await conn.beginTransaction();

    // -------------------------------
    // 1. VALIDATE MAIN ITEM STOCK
    // -------------------------------
    const orderReservedQty = await getOrderReservedQuantity(conn, item_id);
    const existingCartQty = isCocktailOrMocktail ? 0 : await getCartQuantity(conn, userId, item_id, false);

    let stockQty;
    if (!isCocktailOrMocktail) {
      stockQty = await getStockQuantity(conn, item_id);
    }

    // If cocktail, we must have ingredients
    const ingredientsToUse = customIngredients && customIngredients.length > 0 
      ? customIngredients 
      : await getDefaultCocktailIngredientRows(conn, item_id, loginType);

    // if (isCocktailOrMocktail) {
    //   await validateCustomizationStock(conn, ingredientsToUse, quantity);
    // }

    if (isCocktailOrMocktail) {

 const ingredientsWithParentName = ingredientsToUse.map((ingredient) => ({
  ...ingredient,
  parentItemName: itemInfo?.item_name || item_id
}));

  await validateCustomizationStock(conn, ingredientsWithParentName, quantity);
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

    if (existing.length > 0 && !isCocktailOrMocktail) {
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
      if (isCocktailOrMocktail) {
        const normalized = await normalizeCustomizationUpdates(conn, ingredientsToUse);
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
      xi.sub_category AS inventory_subcategory,
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

  const cocktailCartIds = rows
    .filter((row) => [14, 15].includes(Number(row.inventory_subcategory || 0)) && Number(row.price ?? row.inventory_price ?? 0) !== 0)
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

    const isCocktailItem = [14, 15].includes(subcategory);

    const canEdit = isCocktailItem && !isFreeItem;

    const stockQty = Number(row.stock_quantity || 0);
    const stockStatus = isCocktailItem
      ? (cocktailStatusMap.get(Number(row.cart_id)) || "Unknown")
      : stockQty === 0
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
    await ensureCustomizationTable(conn);
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
        throw createValidationError(`Out of stock. Available quantity: ${availableQty}`);
      }
    }
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
    await validateCustomizationStock(conn, ingredientsWithParentName, quantity);
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
    await ensureCustomizationTable(conn);
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

    await conn.execute(`DELETE FROM ${CUSTOMIZATION_TABLE} WHERE cart_id = ?`, [cartId]);

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

    const normalizedSubCategory = Number(subCategory);

   
    const allowedSubCategories =
      normalizedSubCategory === 14
        ? [9, 6, 4, 18]
        : normalizedSubCategory === 15
          ? [2, 5, 6, 11, 12, 1310, 17, 16, 18]
          : [];

    if (allowedSubCategories.length === 0) {
      return [];
    }

    const placeholders = allowedSubCategories.map(() => "?").join(",");

    const query = `
      SELECT
        xi.item_name AS d,
        xi.item_code AS r,
        GREATEST(IFNULL(stock_summary.stock_quantity, 0) - IFNULL(reserved_summary.reserved_quantity, 0), 0) AS stockQuantity,
        xi.unit_price AS unitPrice
      FROM xxafmc_inventory xi
      LEFT JOIN (
        SELECT item_code, IFNULL(SUM(stock_quantity), 0) AS stock_quantity
        FROM xxafmc_stock_out
        GROUP BY item_code
      ) stock_summary
        ON stock_summary.item_code = xi.item_code
      LEFT JOIN (
        SELECT xod.item_id AS item_code, IFNULL(SUM(xod.quantity), 0) AS reserved_quantity
        FROM xxafmc_order_details xod
        LEFT JOIN xxafmc_order_header xoh ON xod.order_id = xoh.order_num
        LEFT JOIN xxafmc_invoices inv ON inv.order_num = xod.order_id
        WHERE xod.order_status IS NULL
          AND xod.price IS NULL
          AND inv.order_num IS NULL
        GROUP BY xod.item_id
      ) reserved_summary
        ON reserved_summary.item_code = xi.item_code
      WHERE xi.sub_category IN (${placeholders})
        AND xi.\`A/C_UNIT\` <> 'Glass'
        AND GREATEST(IFNULL(stock_summary.stock_quantity, 0) - IFNULL(reserved_summary.reserved_quantity, 0), 0) > 0
      ORDER BY xi.item_name
    `;

    const [rows] = await connection.query(query, allowedSubCategories);

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
};
