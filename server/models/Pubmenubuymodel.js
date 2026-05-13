const db = require("../config/db");

const createValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const getStockQuantity = async (connection, itemCode) => {
  const [rows] = await connection.execute(
    `
      SELECT IFNULL(SUM(STOCK_QUANTITY), 0) AS stock
      FROM xxafmc_stock_out
      WHERE item_code = ?
    `,
    [itemCode]
  );

  return Number(rows[0]?.stock || 0);
};

const getReservedOrderQuantity = async (connection, itemCode) => {
  const [rows] = await connection.execute(
    `
      SELECT IFNULL(SUM(xod.quantity), 0) AS reserved
      FROM xxafmc_order_details xod
      LEFT JOIN xxafmc_invoices xi
        ON xi.order_num = xod.order_id
      WHERE xod.item_id = ?
        AND xod.order_status IS NULL
        AND xod.price IS NULL
        AND xi.order_num IS NULL
    `,
    [itemCode]
  );

  return Number(rows[0]?.reserved || 0);
};

async function getNextOrderLineId(connection) {
  const [[row]] = await connection.execute(
    `
      SELECT COALESCE(MAX(order_line_id), 0) + 1 AS nextId
      FROM xxafmc_order_details
    `
  );

  return Number(row?.nextId || 1);
}

async function getInventoryItem(connection, itemCode) {
  const [rows] = await connection.execute(
    `
      SELECT
        ITEM_ID AS item_id,
        ITEM_CODE AS item_code,
        ITEM_NAME AS item_name,
        CATEGORY_ID AS category_id,
        SUB_CATEGORY AS sub_category,
        IFNULL(UNIT_PRICE, 0) AS unit_price,
        IFNULL(NON_MEMBER_PROFIT, 0) AS non_member_profit,
        IFNULL(PR_CHARGES, 0) AS pr_charges,
        IFNULL(PROFIT, 0) AS profit,
        IFNULL(FOOD_PR_CHARGES, 0) AS food_pr_charges,
        IFNULL(\`A/C_UNIT\`, 'Nos') AS ac_unit
      FROM xxafmc_inventory
      WHERE ITEM_CODE = ?
      LIMIT 1
    `,
    [itemCode]
  );

  return rows[0] || null;
}

async function getActiveOffer(connection, itemCode, quantity) {
  const [offerRows] = await connection.execute(
    `
      SELECT
        offer_id,
        item_code,
        free_item_code,
        free_item_quantity,
        offer_quantity
      FROM xxafmc_offers
      WHERE item_code = ?
        AND offer_quantity <= ?
        AND DATE(offer_date) = CURDATE()
        AND UPPER(status) = UPPER('Active')
      ORDER BY offer_id DESC
      LIMIT 1
    `,
    [itemCode, quantity]
  );

  return offerRows[0] || null;
}

async function syncFreeItemForOrderItem(connection, { orderNumber, itemCode, quantity, appUser }) {
  const inventoryItem = await getInventoryItem(connection, itemCode);
  if (!inventoryItem) {
    throw createValidationError("Inventory item not found");
  }

  const subCategory = Number(inventoryItem.sub_category ?? 0);
  if ([14, 15].includes(subCategory)) {
    return;
  }

  const offer = await getActiveOffer(connection, itemCode, quantity);
  if (!offer) {
    await connection.execute(
      `
        DELETE FROM xxafmc_order_details
        WHERE order_id = ?
          AND barcode = ?
          AND price = 0
      `,
      [orderNumber, itemCode]
    );
    return;
  }

  const offerQuantity = Number(offer.offer_quantity || 0);
  const freeItemQuantity = Number(offer.free_item_quantity || 0);
  const computedFreeQty =
    offerQuantity > 0 && freeItemQuantity > 0
      ? Math.floor(quantity / offerQuantity) * freeItemQuantity
      : 0;

  const [existingFreeRows] = await connection.execute(
    `
      SELECT order_line_id, quantity
      FROM xxafmc_order_details
      WHERE order_id = ?
        AND item_id = ?
        AND barcode = ?
        AND price = 0
      ORDER BY order_line_id ASC
      LIMIT 1
    `,
    [orderNumber, offer.free_item_code, itemCode]
  );

  const existingFreeRow = existingFreeRows[0] || null;

  if (computedFreeQty <= 0) {
    if (existingFreeRow) {
      await connection.execute(
        `
          DELETE FROM xxafmc_order_details
          WHERE order_line_id = ?
        `,
        [existingFreeRow.order_line_id]
      );
    }
    return;
  }

  const [freeStockQty, freeReservedQty] = await Promise.all([
    getStockQuantity(connection, offer.free_item_code),
    getReservedOrderQuantity(connection, offer.free_item_code),
  ]);

  const currentExistingQty = Number(existingFreeRow?.quantity || 0);
  const effectiveReservedQty = Math.max(0, freeReservedQty - currentExistingQty);

  if (computedFreeQty + effectiveReservedQty > freeStockQty) {
    const availableFreeQty = Math.max(0, freeStockQty - effectiveReservedQty);
    throw createValidationError(`Out of stock for free item. Available quantity: ${availableFreeQty}`);
  }

  if (existingFreeRow) {
    await connection.execute(
      `
        UPDATE xxafmc_order_details
        SET quantity = ?,
            total_quantity = ?
        WHERE order_line_id = ?
      `,
      [computedFreeQty, quantity, existingFreeRow.order_line_id]
    );
    return;
  }

  const freeInventoryItem = await getInventoryItem(connection, offer.free_item_code);
  const freeOrderLineId = await getNextOrderLineId(connection);

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
          created_by,
          creation_date,
          subcategory,
          barcode
        )
      VALUES
        (?, ?, ?, ?, 0, 0, ?, ?, NOW(), ?, ?)
    `,
    [
      freeOrderLineId,
      orderNumber,
      offer.free_item_code,
      computedFreeQty,
      quantity,
      appUser,
      Number(freeInventoryItem?.sub_category ?? subCategory),
      itemCode,
    ]
  );
}

async function getReservedQuantitiesExcludingOrder(connection, itemCodes, orderNumber) {
  const normalizedCodes = [...new Set((Array.isArray(itemCodes) ? itemCodes : [])
    .map((code) => Number(code))
    .filter((code) => Number.isFinite(code) && code > 0))];

  if (normalizedCodes.length === 0) return new Map();

  const normalizedOrderNumber = Number(orderNumber);
  const placeholders = normalizedCodes.map(() => "?").join(",");

  const [rows] = await connection.execute(
    `
      SELECT
        xod.item_id AS item_code,
        IFNULL(SUM(xod.quantity), 0) AS reserved
      FROM xxafmc_order_details xod
      LEFT JOIN xxafmc_order_header xoh ON xod.order_id = xoh.order_num
      LEFT JOIN xxafmc_invoices xi ON xi.order_num = xod.order_id
      WHERE xod.item_id IN (${placeholders})
        AND xod.order_status IS NULL
        AND xod.price IS NULL
        AND xi.order_num IS NULL
        AND xod.order_id != ?
      GROUP BY xod.item_id
    `,
    [...normalizedCodes, normalizedOrderNumber]
  );

  return rows.reduce((map, row) => {
    map.set(String(row.item_code), Number(row.reserved || 0));
    return map;
  }, new Map());
}

async function getIngredientStockQuantities(connection, ingredientCodes) {
  const normalizedCodes = [...new Set((Array.isArray(ingredientCodes) ? ingredientCodes : [])
    .map((code) => Number(code))
    .filter((code) => Number.isFinite(code) && code > 0))];

  if (normalizedCodes.length === 0) return {};

  const placeholders = normalizedCodes.map(() => "?").join(",");
  const [rows] = await connection.execute(
    `
      SELECT item_code, IFNULL(stock_quantity, 0) AS stock_quantity
      FROM xxafmc_inventory
      WHERE item_code IN (${placeholders})
    `,
    normalizedCodes
  );

  const inventoryMap = rows.reduce((acc, row) => {
    acc[String(row.item_code)] = Number(row.stock_quantity || 0);
    return acc;
  }, {});

  const [stockOutRows] = await connection.execute(
    `
      SELECT item_code, IFNULL(SUM(stock_quantity), 0) AS stock_quantity
      FROM xxafmc_stock_out
      WHERE item_code IN (${placeholders})
      GROUP BY item_code
    `,
    normalizedCodes
  );

  const stockOutMap = stockOutRows.reduce((acc, row) => {
    acc[String(row.item_code)] = Number(row.stock_quantity || 0);
    return acc;
  }, {});

  return normalizedCodes.reduce((acc, code) => {
    const key = String(code);
    acc[key] = Math.max(Number(inventoryMap[key] || 0), Number(stockOutMap[key] || 0));
    return acc;
  }, {});
}

async function getIngredientReservedQuantities(connection, ingredientCodes) {
  const normalizedCodes = [...new Set((Array.isArray(ingredientCodes) ? ingredientCodes : [])
    .map((code) => Number(code))
    .filter((code) => Number.isFinite(code) && code > 0))];

  if (normalizedCodes.length === 0) return {};

  const placeholders = normalizedCodes.map(() => "?").join(",");
  const [rows] = await connection.execute(
    `
      SELECT xod.item_id AS item_code, IFNULL(SUM(xod.quantity), 0) AS reserved_quantity
      FROM xxafmc_order_details xod
      LEFT JOIN xxafmc_order_header xoh ON xod.order_id = xoh.order_num
      LEFT JOIN xxafmc_invoices xi ON xi.order_num = xod.order_id
      WHERE xod.item_id IN (${placeholders})
        AND xod.order_status IS NULL
        AND xod.price IS NULL
        AND xi.order_num IS NULL
      GROUP BY xod.item_id
    `,
    normalizedCodes
  );

  return rows.reduce((acc, row) => {
    acc[String(row.item_code)] = Number(row.reserved_quantity || 0);
    return acc;
  }, {});
}

async function getIngredientReservedQuantitiesExcludingOrder(connection, ingredientCodes, orderNumber, userId = null) {
  const normalizedCodes = [...new Set((Array.isArray(ingredientCodes) ? ingredientCodes : [])
    .map((code) => Number(code))
    .filter((code) => Number.isFinite(code) && code > 0))];

  const normalizedOrderNumber = Number(orderNumber);
  if (normalizedCodes.length === 0) return {};

  if (!Number.isFinite(normalizedOrderNumber) || normalizedOrderNumber <= 0) {
    return getIngredientReservedQuantities(connection, normalizedCodes);
  }

  const placeholders = normalizedCodes.map(() => "?").join(",");
  const userFilter = Number.isFinite(Number(userId)) && Number(userId) > 0;
  const params = [...normalizedCodes, normalizedOrderNumber];

  const [rows] = await connection.execute(
    `
      SELECT xod.item_id AS item_code, IFNULL(SUM(xod.quantity), 0) AS reserved_quantity
      FROM xxafmc_order_details xod
      LEFT JOIN xxafmc_order_header xoh ON xod.order_id = xoh.order_num
      LEFT JOIN xxafmc_invoices xi ON xi.order_num = xod.order_id
      WHERE xod.item_id IN (${placeholders})
        AND xod.order_status IS NULL
        AND xod.price IS NULL
        AND xi.order_num IS NULL
        AND xod.order_id != ?
        ${userFilter ? "AND xoh.user_id = ?" : ""}
      GROUP BY xod.item_id
    `,
    userFilter ? [...params, Number(userId)] : params
  );

  return rows.reduce((acc, row) => {
    acc[String(row.item_code)] = Number(row.reserved_quantity || 0);
    return acc;
  }, {});
}

async function getCocktailStockStatusMap(connection, orderNumber, cocktailItemIds, parentQuantityMap = new Map()) {
  const normalizedOrderNumber = Number(orderNumber);
  const normalizedItems = [...new Set((Array.isArray(cocktailItemIds) ? cocktailItemIds : [])
    .map((code) => Number(code))
    .filter((code) => Number.isFinite(code) && code > 0))];

  if (!Number.isFinite(normalizedOrderNumber) || normalizedOrderNumber <= 0 || normalizedItems.length === 0) {
    return new Map();
  }

  const placeholders = normalizedItems.map(() => "?").join(",");
  const [rows] = await connection.execute(
    `
      SELECT
        x.inventory_item_code AS parent_item_id,
        x.item_code AS ingredient_item_code,
        x.item_name AS ingredient_name,
        x.pegs AS ingredient_pegs,
        x.quantity AS parent_quantity
      FROM (
        SELECT inventory_item_code, item_code, item_name, pegs, quantity
        FROM xxafmc_custom_cocktails_mocktails_details
        WHERE order_number = ?
        UNION ALL
        SELECT inventory_item_code, item_code, item_name, pegs, quantity
        FROM xxafmc_custom_cocktails_mocktails_details_dummy
        WHERE order_number = ?
      ) x
      WHERE x.inventory_item_code IN (${placeholders})
    `,
    [normalizedOrderNumber, normalizedOrderNumber, ...normalizedItems]
  );

  const byParent = rows.reduce((acc, row) => {
    const parentId = Number(row.parent_item_id);
    if (!Number.isFinite(parentId) || parentId <= 0) return acc;
    if (!acc.has(parentId)) acc.set(parentId, []);
    acc.get(parentId).push({
      itemCode: Number(row.ingredient_item_code),
      itemName: String(row.ingredient_name || "").trim(),
      pegs: Number(row.ingredient_pegs || 0),
      parentQuantity: Number(row.parent_quantity || 0),
    });
    return acc;
  }, new Map());

  const ingredientCodes = [...new Set(rows
    .map((row) => Number(row.ingredient_item_code))
    .filter((code) => Number.isFinite(code) && code > 0))];

  const stockMap = await getIngredientStockQuantities(connection, ingredientCodes);
  const reservedMap = await getIngredientReservedQuantitiesExcludingOrder(connection, ingredientCodes, normalizedOrderNumber);

  const statusMap = new Map();
  const debugEnabled = String(process.env.DEBUG_COCKTAIL_STOCK || "") === "1";

  for (const parentId of normalizedItems) {
    const ingredients = byParent.get(parentId) || [];
    if (ingredients.length === 0) continue;

    let failing = null;
    let maxPossibleQty = Infinity;
    const overrideParentQtyRaw = parentQuantityMap.get(parentId);
    const overrideParentQty = Number(overrideParentQtyRaw);
    for (const ingredient of ingredients) {
      const stockQuantity = Number(stockMap[String(ingredient.itemCode)] || 0);
      const reservedQuantity = Number(reservedMap[String(ingredient.itemCode)] || 0);
      const availableQuantity = Math.max(0, stockQuantity - reservedQuantity);
      const parentQty =
        Number.isFinite(overrideParentQty) && overrideParentQty > 0
          ? overrideParentQty
          : Number(ingredient.parentQuantity || 0);
      const requiredQuantity = Number(ingredient.pegs || 0) * parentQty;

      const perCocktailPegs = Number(ingredient.pegs || 0);
      if (perCocktailPegs > 0) {
        maxPossibleQty = Math.min(maxPossibleQty, Math.floor(availableQuantity / perCocktailPegs));
      }

      if (debugEnabled) {
        console.log("[DEBUG_COCKTAIL_STOCK] order", normalizedOrderNumber, "parent", parentId, "ingredient", {
          code: ingredient.itemCode,
          name: ingredient.itemName,
          pegs: ingredient.pegs,
          stockQuantity,
          reservedQuantity,
          availableQuantity,
          parentQty,
          requiredQuantity,
          maxPossibleQty: Number.isFinite(maxPossibleQty) ? maxPossibleQty : null,
        });
      }

      if (requiredQuantity > availableQuantity) {
        failing = {
          itemName: ingredient.itemName || String(ingredient.itemCode),
          availableQuantity,
        };
        break;
      }
    }

    if (failing) {
      statusMap.set(parentId, {
        status: "Out Of Stock",
        message: `Out of stock for ingredient ${failing.itemName}. Available quantity: ${failing.availableQuantity}`,
        maxQuantity: Number.isFinite(maxPossibleQty) ? Math.max(0, maxPossibleQty) : null,
      });
    } else {
      statusMap.set(parentId, {
        status: "In Stock",
        message: null,
        maxQuantity: Number.isFinite(maxPossibleQty) ? Math.max(0, maxPossibleQty) : null,
      });
    }
  }

  // Fallback to legacy ingredient mapping when customization rows don't exist yet
  // (mirrors cart validation behavior).
  const missingParentIds = normalizedItems.filter((parentId) => !statusMap.has(parentId));
  if (missingParentIds.length > 0) {
    const missingPlaceholders = missingParentIds.map(() => "?").join(",");
    const [legacyRows] = await connection.execute(
      `
        SELECT
          inventory_item_code AS parent_item_id,
          item_code AS ingredient_item_code,
          item_name AS ingredient_name,
          pegs AS ingredient_pegs
        FROM xxafmc_cocktails_mocktails_details
        WHERE inventory_item_code IN (${missingPlaceholders})
      `,
      missingParentIds
    );

    const legacyByParent = legacyRows.reduce((acc, row) => {
      const parentId = Number(row.parent_item_id);
      if (!Number.isFinite(parentId) || parentId <= 0) return acc;
      if (!acc.has(parentId)) acc.set(parentId, []);
      acc.get(parentId).push({
        itemCode: Number(row.ingredient_item_code),
        itemName: String(row.ingredient_name || "").trim(),
        pegs: Number(row.ingredient_pegs || 0),
      });
      return acc;
    }, new Map());

    const legacyIngredientCodes = [...new Set(legacyRows
      .map((row) => Number(row.ingredient_item_code))
      .filter((code) => Number.isFinite(code) && code > 0))];

    const legacyStockMap = await getIngredientStockQuantities(connection, legacyIngredientCodes);
    const legacyReservedMap = await getIngredientReservedQuantitiesExcludingOrder(connection, legacyIngredientCodes, normalizedOrderNumber);

    // (Optional) local debugging: set DEBUG_COCKTAIL_STOCK=1 to print stock calculations.
    if (debugEnabled) {
      console.log("[DEBUG_COCKTAIL_STOCK] order", normalizedOrderNumber, "missingParents", missingParentIds);
      console.log("[DEBUG_COCKTAIL_STOCK] legacyIngredientCodes", legacyIngredientCodes);
      console.log("[DEBUG_COCKTAIL_STOCK] legacyStockMap", legacyStockMap);
      console.log("[DEBUG_COCKTAIL_STOCK] legacyReservedMap", legacyReservedMap);
      console.log("[DEBUG_COCKTAIL_STOCK] parentQuantityMap", Object.fromEntries(parentQuantityMap.entries()));
    }

    for (const parentId of missingParentIds) {
      const ingredients = legacyByParent.get(parentId) || [];
      if (ingredients.length === 0) {
        statusMap.set(parentId, { status: "Unknown", message: null, maxQuantity: null });
        continue;
      }

      const parentQuantity = Number(parentQuantityMap.get(parentId) || 0);
      if (!Number.isFinite(parentQuantity) || parentQuantity <= 0) {
        statusMap.set(parentId, { status: "Unknown", message: null, maxQuantity: null });
        continue;
      }

      let failing = null;
      let maxPossibleQty = Infinity;
      for (const ingredient of ingredients) {
        const stockQuantity = Number(legacyStockMap[String(ingredient.itemCode)] || 0);
        const reservedQuantity = Number(legacyReservedMap[String(ingredient.itemCode)] || 0);
        const availableQuantity = Math.max(0, stockQuantity - reservedQuantity);
        const requiredQuantity = Number(ingredient.pegs || 0) * parentQuantity;

        const perCocktailPegs = Number(ingredient.pegs || 0);
        if (perCocktailPegs > 0) {
          maxPossibleQty = Math.min(maxPossibleQty, Math.floor(availableQuantity / perCocktailPegs));
        }

        if (requiredQuantity > availableQuantity) {
          failing = {
            itemName: ingredient.itemName || String(ingredient.itemCode),
            availableQuantity,
          };
          break;
        }
      }

      if (failing) {
        statusMap.set(parentId, {
          status: "Out Of Stock",
          message: `Out of stock for ingredient ${failing.itemName}. Available quantity: ${failing.availableQuantity}`,
          maxQuantity: Number.isFinite(maxPossibleQty) ? Math.max(0, maxPossibleQty) : null,
        });
      } else {
        statusMap.set(parentId, {
          status: "In Stock",
          message: null,
          maxQuantity: Number.isFinite(maxPossibleQty) ? Math.max(0, maxPossibleQty) : null,
        });
      }
    }
  }

  return statusMap;
}

async function getOrderSummary(orderNumber) {
  const normalizedOrderNumber = Number(orderNumber);
  if (!Number.isFinite(normalizedOrderNumber) || normalizedOrderNumber <= 0) {
    const error = new Error("Valid order number is required");
    error.statusCode = 400;
    throw error;
  }

  const [headerRows] = await db.execute(
    `
      SELECT
        order_num,
        user_id,
        order_date
      FROM xxafmc_order_header
      WHERE order_num = ?
      LIMIT 1
    `,
    [normalizedOrderNumber]
  );

  if (!headerRows.length) {
    const error = new Error("Order not found");
    error.statusCode = 404;
    throw error;
  }

  const [totalRows] = await db.execute(
    `
      SELECT COALESCE(SUM(subtotal), 0) AS order_total
      FROM xxafmc_order_details
      WHERE order_id = ?
    `,
    [normalizedOrderNumber]
  );

  const orderTotal = Number(totalRows[0]?.order_total || 0);

  const [foodRows] = await db.execute(
    `
      SELECT COALESCE(SUM(food_pr_charges), 0) AS food_pr_charges
      FROM xxafmc_order_details
      WHERE order_id = ?
    `,
    [normalizedOrderNumber]
  );

  const foodPrChargesSum = Number(foodRows[0]?.food_pr_charges || 0);
  const foodPrCharges =
    foodPrChargesSum === 0 ? "Not Applicable" : Number(foodPrChargesSum.toFixed(2));

  const [itemIdRows] = await db.execute(
    `
      SELECT item_id AS item_id
      FROM xxafmc_order_details
      WHERE order_id = ?
      ORDER BY order_line_id ASC
      LIMIT 1
    `,
    [normalizedOrderNumber]
  );

  const [itemRows] = await db.execute(
    `
      SELECT
        xxod.ORDER_LINE_ID AS order_line_id,
        xxod.ITEM_ID AS item_id,
        xxod.QUANTITY AS quantity,
        xxod.PRICE AS price,
        xxod.BARCODE AS barcode,
        XXINV.SUB_CATEGORY AS subcategory,
        CONCAT(
          'Name: ', XXINV.ITEM_NAME,
          ' Quantity: ', xxod.QUANTITY
        ) AS card_text,
        xxod.SUBTOTAL AS subtotal,
        XXINV.IMAGE AS image,
        LENGTH(XXINV.IMAGE) AS card_title,
        XXINV.ITEM_CODE AS item_code,
        CASE
          WHEN XXINV.SUB_CATEGORY IN (14, 15) THEN NULL
          ELSE COALESCE(
            NULLIF(XXINV.STOCK_QUANTITY, 0),
            (
              SELECT IFNULL(SUM(stock_quantity), 0)
              FROM xxafmc_stock_out so
              WHERE so.item_code = XXINV.ITEM_CODE
            ),
            0
          )
        END AS stock_quantity,
        '#' AS card_link,
        CASE
          WHEN xxod.PRICE = 0 THEN NULL
          ELSE NULL
        END AS card_subtext
      FROM xxafmc_order_details xxod
      JOIN xxafmc_inventory XXINV
        ON xxod.item_id = XXINV.item_code
      WHERE xxod.order_id = ?
      ORDER BY xxod.order_line_id ASC
    `,
    [normalizedOrderNumber]
  );

  const itemCodes = itemRows
    .map((row) => Number(row.item_code))
    .filter((code) => Number.isFinite(code) && code > 0);
  const reservedMap = await getReservedQuantitiesExcludingOrder(db, itemCodes, normalizedOrderNumber);

  const cocktailParents = itemRows
    .filter((row) => [14, 15].includes(Number(row.subcategory)))
    .map((row) => ({
      itemId: Number(row.item_id),
      quantity: Number(row.quantity || 0),
    }))
    .filter((row) => Number.isFinite(row.itemId) && row.itemId > 0);

  const cocktailItemIds = cocktailParents.map((row) => row.itemId);
  const cocktailParentQuantityMap = cocktailParents.reduce((map, row) => {
    map.set(row.itemId, row.quantity);
    return map;
  }, new Map());

  const cocktailStatusMap = await getCocktailStockStatusMap(
    db,
    normalizedOrderNumber,
    cocktailItemIds,
    cocktailParentQuantityMap
  );

  // Get offer details for items
  const [offerRows] = await db.execute(
    `
      SELECT
        item_code,
        offer_quantity,
        free_item_quantity,
        free_item_code
      FROM xxafmc_offers
      WHERE item_code IN (${itemCodes.map(() => '?').join(',')})
        AND (
          (END_DATE IS NULL AND CURDATE() >= DATE(OFFER_DATE))
          OR (CURDATE() BETWEEN DATE(OFFER_DATE) AND END_DATE)
        )
        AND UPPER(status) = UPPER('Active')
      ORDER BY item_code, offer_quantity DESC
    `,
    itemCodes
  );

  const offerMap = new Map();
  offerRows.forEach((offer) => {
    if (!offerMap.has(offer.item_code)) {
      offerMap.set(offer.item_code, offer);
    }
  });

  const enrichedItems = itemRows.map((row) => {
    const subcategory = Number(row.subcategory || 0);
    const isCocktailItem = [14, 15].includes(subcategory);

    const reservedQuantity = Number(reservedMap.get(String(row.item_code)) || 0);
    const stockQuantity = row.stock_quantity == null ? null : Number(row.stock_quantity || 0);
    const availableQuantity = stockQuantity == null ? null : Math.max(0, stockQuantity - reservedQuantity);

    const cocktailStatus = isCocktailItem ? cocktailStatusMap.get(Number(row.item_id)) : null;
    const stockStatus = isCocktailItem
      ? (cocktailStatus?.status || "Unknown")
      : availableQuantity === 0
        ? "Out Of Stock"
        : "In Stock";

    const stockIssueMessage = isCocktailItem
      ? (cocktailStatus?.message || null)
      : null;

    const cocktailMaxQuantity = isCocktailItem ? (cocktailStatus?.maxQuantity ?? null) : null;
    const normalizedAvailableQuantity = isCocktailItem ? cocktailMaxQuantity : availableQuantity;

    const offer = offerMap.get(Number(row.item_code));
    return {
      ...row,
      RESERVED_QUANTITY: reservedQuantity,
      AVAILABLE_QUANTITY: normalizedAvailableQuantity,
      stock_status: stockStatus,
      stock_issue_message: stockIssueMessage,
      offer_quantity: offer?.offer_quantity || null,
      free_item_quantity: offer?.free_item_quantity || null,
      free_item_code: offer?.free_item_code || null,
    };
  });

  return {
    header: {
      ...headerRows[0],
      item_id: itemIdRows[0]?.item_id || null,
      order_total: Number(orderTotal.toFixed(2)),
      food_pr_charges: foodPrCharges,
    },
    items: enrichedItems,
  };
}

async function cancelOrder(orderNumber) {
  const normalizedOrderNumber = Number(orderNumber);
  if (!Number.isFinite(normalizedOrderNumber) || normalizedOrderNumber <= 0) {
    const error = new Error("Valid order number is required");
    error.statusCode = 400;
    throw error;
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [[orderRow]] = await connection.execute(
      `
        SELECT order_num
             , user_id
        FROM xxafmc_order_header
        WHERE order_num = ?
        LIMIT 1
      `,
      [normalizedOrderNumber]
    );

    if (!orderRow) {
      const error = new Error("Order not found");
      error.statusCode = 404;
      throw error;
    }

    const [[notificationRow]] = await connection.execute(
      `
        SELECT COUNT(*) AS notificationCount
        FROM xxafmc_kitchen_notification
        WHERE ordernumber = ?
          AND status IS NOT NULL
      `,
      [normalizedOrderNumber]
    );

    const notificationCount = Number(notificationRow?.notificationCount || 0);

    if (notificationCount > 0) {
      const error = new Error("Order cannot be cancelled because kitchen processing has already started");
      error.statusCode = 400;
      throw error;
    }

    const userId = orderRow?.user_id || null;

    await connection.execute(
      `
        DELETE FROM xxafmc_custom_cocktails_mocktails_details
        WHERE order_number = ?
      `,
      [normalizedOrderNumber]
    );

    await connection.execute(
      `
        DELETE FROM xxafmc_custom_cocktails_mocktails_details_dummy
        WHERE order_number = ?
      `,
      [normalizedOrderNumber]
    );

    await connection.execute(
      `
        DELETE FROM xxafmc_order_details
        WHERE order_id = ?
      `,
      [normalizedOrderNumber]
    );

    await connection.execute(
      `
        DELETE FROM xxafmc_order_header
        WHERE order_num = ?
      `,
      [normalizedOrderNumber]
    );

    if (userId) {
      await connection.execute(`DELETE FROM xxafmc_cart_items WHERE user_id = ?`, [userId]);
    }

    await connection.commit();

    return {
      orderNumber: normalizedOrderNumber,
      message: "Order cancelled",
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateOrderItemQuantity(orderNumber, itemCode, delta, authUser = {}) {
  const normalizedOrderNumber = Number(orderNumber);
  const normalizedItemCode = Number(itemCode);
  const normalizedDelta = Number(delta);

  if (!Number.isFinite(normalizedOrderNumber) || normalizedOrderNumber <= 0) {
    throw createValidationError("Valid order number is required");
  }

  if (!Number.isFinite(normalizedItemCode) || normalizedItemCode <= 0) {
    throw createValidationError("Valid item code is required");
  }

  if (![1, -1].includes(normalizedDelta)) {
    throw createValidationError("Valid quantity delta is required");
  }

  const appUser = authUser?.username || authUser?.user_name || "SYSTEM";
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [[existingRow]] = await connection.execute(
      `
        SELECT order_line_id, item_id, quantity, subcategory, price, barcode
        FROM xxafmc_order_details
        WHERE order_id = ?
          AND item_id = ?
          AND (price IS NULL OR price <> 0)
        ORDER BY order_line_id ASC
        LIMIT 1
      `,
      [normalizedOrderNumber, normalizedItemCode]
    );

    if (!existingRow) {
      const error = new Error("Order item not found");
      error.statusCode = 404;
      throw error;
    }

    const currentQty = Number(existingRow.quantity || 0);
    const nextQty = currentQty + normalizedDelta;
    const itemSubCategory = Number(existingRow.subcategory ?? 0);
    const isMocktailItem = [14, 15].includes(itemSubCategory);

    if (nextQty <= 0) {
      throw createValidationError("Quantity cannot be less than 1");
    }

    if (isMocktailItem && nextQty > 5) {
      throw createValidationError("Quantity must be 5 or less");
    }

    if (!isMocktailItem) {
      const [stockQty, reservedQty] = await Promise.all([
        getStockQuantity(connection, normalizedItemCode),
        getReservedOrderQuantity(connection, normalizedItemCode),
      ]);

      const effectiveReservedQty = Math.max(0, reservedQty - currentQty);
      if (nextQty + effectiveReservedQty > stockQty) {
        const availableQty = Math.max(0, stockQty - effectiveReservedQty);
        throw createValidationError(`Out of stock. Available quantity: ${availableQty}`);
      }
    }

    await connection.execute(
      `
        UPDATE xxafmc_order_details
        SET quantity = ?,
            total_quantity = ?
        WHERE order_line_id = ?
      `,
      [nextQty, nextQty, existingRow.order_line_id]
    );

    await syncFreeItemForOrderItem(connection, {
      orderNumber: normalizedOrderNumber,
      itemCode: normalizedItemCode,
      quantity: nextQty,
      appUser,
    });

    await connection.commit();
    return getOrderSummary(normalizedOrderNumber);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deleteOrderItem(orderNumber, itemCode) {
  const normalizedOrderNumber = Number(orderNumber);
  const normalizedItemCode = Number(itemCode);

  if (!Number.isFinite(normalizedOrderNumber) || normalizedOrderNumber <= 0) {
    throw createValidationError("Valid order number is required");
  }

  if (!Number.isFinite(normalizedItemCode) || normalizedItemCode <= 0) {
    throw createValidationError("Valid item code is required");
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [[existingRow]] = await connection.execute(
      `
        SELECT order_line_id
        FROM xxafmc_order_details
        WHERE order_id = ?
          AND item_id = ?
          AND (price IS NULL OR price <> 0)
        ORDER BY order_line_id ASC
        LIMIT 1
      `,
      [normalizedOrderNumber, normalizedItemCode]
    );

    if (!existingRow) {
      const error = new Error("Order item not found");
      error.statusCode = 404;
      throw error;
    }

    await connection.execute(
      `
        DELETE FROM xxafmc_order_details
        WHERE order_id = ?
          AND (
            order_line_id = ?
            OR (barcode = ? AND price = 0)
          )
      `,
      [normalizedOrderNumber, existingRow.order_line_id, normalizedItemCode]
    );

    const [[remainingRow]] = await connection.execute(
      `
        SELECT COUNT(*) AS rowCount
        FROM xxafmc_order_details
        WHERE order_id = ?
      `,
      [normalizedOrderNumber]
    );

    if (Number(remainingRow?.rowCount || 0) === 0) {
      await connection.execute(
        `
          DELETE FROM xxafmc_order_header
          WHERE order_num = ?
        `,
        [normalizedOrderNumber]
      );
    }

    await connection.commit();
    return { orderNumber: normalizedOrderNumber, deleted: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function createOrder(payload = {}, authUser = {}) {
  const itemCode = Number(payload.itemCode);
  const rawQuantity = payload.quantity;
  const quantity = Number(rawQuantity || 1);
  const categoryId = Number(payload.categoryId);
  const remarks = String(payload.remarks || "").trim();
  const memberId =
    payload.memberId === undefined || payload.memberId === null || payload.memberId === ""
      ? null
      : Number(payload.memberId);
  const pubmed =
    payload.pubmed === undefined || payload.pubmed === null || payload.pubmed === ""
      ? null
      : payload.pubmed;

  if (!Number.isFinite(itemCode) || itemCode <= 0) {
    const error = new Error("Valid itemCode is required");
    error.statusCode = 400;
    throw error;
  }

  if (!remarks) {
    throw createValidationError("Remarks is required");
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw createValidationError("Valid quantity is required");
  }

  if (!Number.isInteger(quantity)) {
    throw createValidationError("Quantity is not in decimals");
  }

  const appUser = authUser?.username || authUser?.user_name || "SYSTEM";
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [userRows] = await connection.execute(
      `
        SELECT user_id, role_id
        FROM xxafmc_users
        WHERE UPPER(user_name) = UPPER(?)
        LIMIT 1
      `,
      [appUser]
    );

    if (!userRows.length) {
      const error = new Error("Logged in user not found");
      error.statusCode = 404;
      throw error;
    }

    const userId = userRows[0].user_id;
    const roleId = Number(userRows[0].role_id || 0);

    const inventoryItem = await getInventoryItem(connection, itemCode);

    if (!inventoryItem) {
      const error = new Error("Inventory item not found");
      error.statusCode = 404;
      throw error;
    }
    const resolvedCategoryId = Number.isFinite(categoryId) ? categoryId : Number(inventoryItem.category_id);
    const subCategory = Number(inventoryItem.sub_category ?? 0);
    const isMocktailItem = Number(resolvedCategoryId) === 10 && [14, 15].includes(subCategory);
    const profit =
      roleId === 20
        ? Number(inventoryItem.profit || 0)
        : Number(inventoryItem.non_member_profit || 0);
    const foodPrCharges =
      roleId === 20
        ? Number(inventoryItem.food_pr_charges || 0)
        : Number(inventoryItem.pr_charges || 0);

    const unitPrice = Number(inventoryItem.unit_price || 0);
    const subtotal = Number((unitPrice * quantity).toFixed(2));

    if (isMocktailItem && quantity > 5) {
      throw createValidationError("Quantity must be 5 or less");
    }

    if (!isMocktailItem) {
      const [stockQty, reservedQty] = await Promise.all([
        getStockQuantity(connection, itemCode),
        getReservedOrderQuantity(connection, itemCode),
      ]);

      if (quantity + reservedQty > stockQty) {
        const availableQty = Math.max(0, stockQty - reservedQty);
        throw createValidationError(`Out of stock. Available quantity: ${availableQty}`);
      }
    }

    let typeId = null;
    if (Number(resolvedCategoryId) === 10) {
      const [typeRows] = await connection.execute(
        `
          SELECT type_id
          FROM xxafmc_bar
          WHERE UPPER(type) = UPPER(?)
          LIMIT 1
        `,
        [String(payload.type || inventoryItem.ac_unit || "Nos")]
      );
      typeId = typeRows[0]?.type_id || null;
    }

    const [headerResult] = await connection.execute(
      `
        INSERT INTO xxafmc_order_header
          (user_id, order_date, member_id, pubmed, created_by, creation_date)
        VALUES
          (?, NOW(), ?, ?, ?, NOW())
      `,
      [userId, memberId, pubmed, appUser]
    );

    const orderNumber = headerResult.insertId;
    const orderLineId = await getNextOrderLineId(connection);

    if (Number(resolvedCategoryId) === 10) {
      await connection.execute(
        `
          INSERT INTO xxafmc_order_details
            (
              order_line_id,
              order_id,
              item_id,
              type_id,
              quantity,
              type,
              price,
              subtotal,
              total_quantity,
              created_by,
              creation_date,
              subcategory,
              profit,
              food_pr_charges
            )
          VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?)
        `,
        [
          orderLineId,
          orderNumber,
          itemCode,
          typeId,
          quantity,
          remarks,
          unitPrice,
          subtotal,
          quantity,
          appUser,
          subCategory,
          profit,
          foodPrCharges,
        ]
      );
    } else {
      await connection.execute(
        `
          INSERT INTO xxafmc_order_details
            (
              order_line_id,
              order_id,
              item_id,
              quantity,
              price,
              subtotal,
              total_quantity,
              created_by,
              creation_date,
              subcategory,
              profit,
              food_pr_charges
            )
          VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?)
        `,
        [orderLineId, orderNumber, itemCode, quantity, unitPrice, subtotal, quantity, appUser, subCategory, profit, foodPrCharges]
      );
    }

    await syncFreeItemForOrderItem(connection, {
      orderNumber,
      itemCode,
      quantity,
      appUser,
    });

    await connection.commit();

    return {
      orderNumber,
      userId,
      orderDate: new Date().toISOString(),
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateOrderLineQuantity(orderNumber, orderLineId, userId, quantity) {
  const normalizedOrderNumber = Number(orderNumber);
  const normalizedOrderLineId = Number(orderLineId);
  const normalizedUserId = Number(userId);
  const normalizedQuantity = Number(quantity);

  if (!Number.isFinite(normalizedOrderNumber) || normalizedOrderNumber <= 0) {
    const error = new Error("Valid order number is required");
    error.statusCode = 400;
    throw error;
  }
  if (!Number.isFinite(normalizedOrderLineId) || normalizedOrderLineId <= 0) {
    const error = new Error("Valid order line id is required");
    error.statusCode = 400;
    throw error;
  }
  if (!Number.isFinite(normalizedUserId) || normalizedUserId <= 0) {
    const error = new Error("Valid user id is required");
    error.statusCode = 400;
    throw error;
  }
  if (!Number.isFinite(normalizedQuantity) || normalizedQuantity < 1) {
    const error = new Error("Valid quantity is required");
    error.statusCode = 400;
    throw error;
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [[headerRow]] = await connection.execute(
      `SELECT order_num, user_id FROM xxafmc_order_header WHERE order_num = ? LIMIT 1`,
      [normalizedOrderNumber]
    );

    if (!headerRow) {
      const error = new Error("Order not found");
      error.statusCode = 404;
      throw error;
    }

    if (Number(headerRow.user_id) !== normalizedUserId) {
      const error = new Error("You are not allowed to modify this order");
      error.statusCode = 403;
      throw error;
    }

    const [[detailRow]] = await connection.execute(
      `
        SELECT od.order_line_id, od.item_id, od.price, od.quantity, od.subtotal, od.subcategory, od.created_by
        FROM xxafmc_order_details od
        WHERE od.order_id = ?
          AND od.order_line_id = ?
        LIMIT 1
      `,
      [normalizedOrderNumber, normalizedOrderLineId]
    );

    if (!detailRow) {
      const error = new Error("Order item not found");
      error.statusCode = 404;
      throw error;
    }

    const itemId = Number(detailRow.item_id);
    const storedPrice = detailRow.price;
    const hasStoredPrice = storedPrice !== null && storedPrice !== undefined && storedPrice !== "";
    const price = hasStoredPrice ? Number(storedPrice) : Number.NaN;
    const currentQty = Number(detailRow.quantity || 0);
    const currentSubtotal = Number(detailRow.subtotal || 0);
    const unitPrice =
      Number.isFinite(price) && price >= 0
        ? price
        : currentQty > 0
          ? Number((currentSubtotal / currentQty).toFixed(2))
          : 0;

    const isFreeLine = Number(unitPrice || 0) === 0 && Number(currentSubtotal || 0) === 0;
    if (isFreeLine) {
      const error = new Error("Free items cannot be updated");
      error.statusCode = 400;
      throw error;
    }

    const [[invRow]] = await connection.execute(
      `
        SELECT
          xi.sub_category AS subcategory,
          COALESCE(
            NULLIF(xi.stock_quantity, 0),
            (
              SELECT IFNULL(SUM(stock_quantity), 0)
              FROM xxafmc_stock_out so
              WHERE so.item_code = xi.item_code
            ),
            0
          ) AS stock_quantity
        FROM xxafmc_inventory xi
        WHERE xi.item_code = ?
        LIMIT 1
      `,
      [itemId]
    );

    const inventorySubcategory = Number(invRow?.subcategory || 0);
    const isCocktailOrMocktail = [14, 15].includes(inventorySubcategory);

    if (isCocktailOrMocktail) {
      const statusMap = await getCocktailStockStatusMap(
        connection,
        normalizedOrderNumber,
        [itemId],
        new Map([[itemId, normalizedQuantity]])
      );
      const status = statusMap.get(itemId);
      if (String(status?.status || "").toLowerCase() === "out of stock") {
        const error = new Error(
          status?.message ||
            "Out of stock for cocktail/mocktail ingredients. Please reduce quantity or update selection."
        );
        error.statusCode = 400;
        throw error;
      }
    } else {

      const stockQuantity = Number(invRow?.stock_quantity || 0);
      const reservedMap = await getReservedQuantitiesExcludingOrder(connection, [itemId], normalizedOrderNumber);
      const reservedQuantity = Number(reservedMap.get(String(itemId)) || 0);
      const availableQuantity = Math.max(0, stockQuantity - reservedQuantity);

      if (normalizedQuantity > availableQuantity) {
        const error = new Error(`Out of stock. Available quantity: ${availableQuantity}`);
        error.statusCode = 400;
        throw error;
      }
    }

    await connection.execute(
      `UPDATE xxafmc_order_details SET quantity = ?, subtotal = ? WHERE order_id = ? AND order_line_id = ?`,
      [
        normalizedQuantity,
        Number((normalizedQuantity * unitPrice).toFixed(2)),
        normalizedOrderNumber,
        normalizedOrderLineId,
      ]
    );

    // -------------------------------
    // Keep "Buy X Get Y" free items in sync with parent quantity
    // - Free lines are stored with `price=0`, `subtotal=0`, and `barcode=parent_item_code`
    // -------------------------------
    const [offerRows] = await connection.execute(
      `
        SELECT
          offer_id,
          item_code,
          free_item_code,
          free_item_quantity,
          offer_quantity
        FROM xxafmc_offers
        WHERE item_code = ?
          AND offer_quantity <= ?
          AND (
            (END_DATE IS NULL AND CURDATE() >= DATE(OFFER_DATE))
            OR (CURDATE() BETWEEN DATE(OFFER_DATE) AND END_DATE)
          )
          AND UPPER(status) = UPPER('Active')
        ORDER BY offer_quantity DESC, offer_id DESC
        LIMIT 1
      `,
      [itemId, normalizedQuantity]
    );

    if (offerRows.length > 0) {
      const offer = offerRows[0];
      const offerQuantity = Number(offer.offer_quantity || 0);
      const freeItemQuantity = Number(offer.free_item_quantity || 0);
      const freeItemCode = Number(offer.free_item_code || 0);

      const computedFreeQty =
        offerQuantity > 0 && freeItemQuantity > 0
          ? Math.floor(normalizedQuantity / offerQuantity) * freeItemQuantity
          : 0;

      // Validate free item stock (respect reserved quantities excluding this order)
      if (computedFreeQty > 0 && Number.isFinite(freeItemCode) && freeItemCode > 0) {
        const [[freeInvRow]] = await connection.execute(
          `
            SELECT
              COALESCE(
                NULLIF(xi.stock_quantity, 0),
                (
                  SELECT IFNULL(SUM(stock_quantity), 0)
                  FROM xxafmc_stock_out so
                  WHERE so.item_code = xi.item_code
                ),
                0
              ) AS stock_quantity
            FROM xxafmc_inventory xi
            WHERE xi.item_code = ?
            LIMIT 1
          `,
          [freeItemCode]
        );

        const freeStockQuantity = Number(freeInvRow?.stock_quantity || 0);
        const freeReservedMap = await getReservedQuantitiesExcludingOrder(
          connection,
          [freeItemCode],
          normalizedOrderNumber
        );
        const freeReservedQuantity = Number(freeReservedMap.get(String(freeItemCode)) || 0);
        const freeAvailableQuantity = Math.max(0, freeStockQuantity - freeReservedQuantity);

        if (computedFreeQty > freeAvailableQuantity) {
          const error = new Error(`Out of stock for free item. Available quantity: ${freeAvailableQuantity}`);
          error.statusCode = 400;
          throw error;
        }
      }

      // Upsert free line (linked via barcode = parent item code)
      const [[freeLine]] = await connection.execute(
        `
          SELECT order_line_id
          FROM xxafmc_order_details
          WHERE order_id = ?
            AND item_id = ?
            AND IFNULL(price, 0) = 0
            AND IFNULL(subtotal, 0) = 0
            AND barcode = ?
          ORDER BY order_line_id DESC
          LIMIT 1
        `,
        [normalizedOrderNumber, freeItemCode, String(itemId)]
      );

      if (computedFreeQty <= 0) {
        if (freeLine?.order_line_id) {
          await connection.execute(
            `DELETE FROM xxafmc_order_details WHERE order_id = ? AND order_line_id = ?`,
            [normalizedOrderNumber, Number(freeLine.order_line_id)]
          );
        }
      } else if (freeLine?.order_line_id) {
        await connection.execute(
          `UPDATE xxafmc_order_details SET quantity = ?, total_quantity = ? WHERE order_id = ? AND order_line_id = ?`,
          [computedFreeQty, normalizedQuantity, normalizedOrderNumber, Number(freeLine.order_line_id)]
        );
      } else {
        const freeOrderLineId = await getNextOrderLineId(connection);
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
                created_by,
                creation_date,
                subcategory,
                barcode
              )
            VALUES
              (?, ?, ?, ?, 0, 0, ?, ?, NOW(), ?, ?)
          `,
          [
            freeOrderLineId,
            normalizedOrderNumber,
            freeItemCode,
            computedFreeQty,
            normalizedQuantity,
            detailRow.created_by || String(normalizedUserId),
            detailRow.subcategory ?? null,
            String(itemId),
          ]
        );
      }
    }

    await connection.commit();
    return getOrderSummary(normalizedOrderNumber);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  createOrder,
  getOrderSummary,
  cancelOrder,
  updateOrderItemQuantity,
  deleteOrderItem,
  updateOrderLineQuantity,
};
