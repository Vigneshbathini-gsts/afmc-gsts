const db = require("../../config/db");
const { usesNonMemberPricing } = require("../../helpers/customerPricing");
const { isExcludedLiquorSubcategory } = require("../../helpers/pricingHelper");

const createValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

// Helper function to get peg multiplier based on type (same as cart model)
const getPegTypeValue = (value) => {
  const raw = value?.type ?? value?.TYPE ?? value ?? null;
  return String(raw ?? "").trim();
};

const getPegMultiplierForType = (type) => {
  return getPegTypeValue(type).toLowerCase() === "large" ? 2 : 1;
};

async function getReservedTotalsForUpdate(connection, itemCode) {
  await connection.execute(
    `
      INSERT IGNORE INTO xxafmc_stock_reservation_totals (item_code, reserved_qty)
      VALUES (?, 0)
    `,
    [itemCode]
  );

  const [[row]] = await connection.execute(
    `
      SELECT item_code, reserved_qty
      FROM xxafmc_stock_reservation_totals
      WHERE item_code = ?
      LIMIT 1
      FOR UPDATE
    `,
    [itemCode]
  );

  return row || { item_code: itemCode, reserved_qty: 0 };
}

async function getInventoryStockForUpdate(connection, itemCode) {
  const [[stockRow]] = await connection.execute(
    `
      SELECT IFNULL(SUM(STOCK_QUANTITY), 0) AS actual_qty
      FROM xxafmc_stock_out
      WHERE item_code = ?
    `,
    [itemCode]
  );

  return {
    ...(await getReservedTotalsForUpdate(connection, itemCode)),
    actual_qty: Number(stockRow?.actual_qty || 0),
  };
}

async function reserveInventoryQty(connection, itemCode, quantity, itemName = null) {
  const qty = Number(quantity || 0);
  if (!Number.isFinite(qty) || qty <= 0) return;

  const stockRow = await getInventoryStockForUpdate(connection, itemCode);

  const actualQty = Number(stockRow.actual_qty || 0);
  const reservedQty = Number(stockRow.reserved_qty || 0);
  const availableQty = Math.max(0, actualQty - reservedQty);

  // console.log(`[RESERVE] Checking stock for item ${itemCode}:`, {
  //   actualQty,
  //   reservedQty,
  //   availableQty,
  //   requestedQty: qty,
  //   itemName
  // });

  if (qty > availableQty) {
    const namePart = itemName ? ` for ${itemName}` : "";
    // console.log(`[RESERVE] ❌ OUT OF STOCK - ${itemCode}:`, {
    //   requested: qty,
    //   available: availableQty
    // });
    throw createValidationError(`Out of stock${namePart}. Available quantity: ${availableQty}`);
  }

  await connection.execute(
    `
      UPDATE xxafmc_stock_reservation_totals
      SET reserved_qty = IFNULL(reserved_qty, 0) + ?
      WHERE item_code = ?
      LIMIT 1
    `,
    [qty, itemCode]
  );

  // console.log(`[RESERVE] ✅ Reserved ${qty} units for item ${itemCode}`);
}

async function releaseInventoryQty(connection, itemCode, quantity) {
  const qty = Number(quantity || 0);
  if (!Number.isFinite(qty) || qty <= 0) return;

  await connection.execute(
    `
      UPDATE xxafmc_stock_reservation_totals
      SET reserved_qty = GREATEST(0, IFNULL(reserved_qty, 0) - ?)
      WHERE item_code = ?
      LIMIT 1
    `,
    [qty, itemCode]
  );
}

async function consumeInventoryQty(connection, itemCode, quantity) {
  const qty = Number(quantity || 0);
  if (!Number.isFinite(qty) || qty <= 0) return;

  await connection.execute(
    `
      UPDATE xxafmc_stock_reservation_totals
      SET reserved_qty = GREATEST(0, IFNULL(reserved_qty, 0) - ?)
      WHERE item_code = ?
      LIMIT 1
    `,
    [qty, itemCode]
  );
}

async function hasMultipleOrderLinesForItem(connection, orderNumber, itemCode) {
  const [[row]] = await connection.execute(
    `
      SELECT COUNT(*) AS lineCount
      FROM xxafmc_order_details
      WHERE order_id = ?
        AND item_id = ?
        AND (price IS NULL OR price <> 0)
    `,
    [orderNumber, itemCode]
  );
  return Number(row?.lineCount || 0) > 1;
}

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
        IFNULL(\`A/C_UNIT\`, 'Nos') AS ac_unit,
        IFNULL(TYPE, '') AS type,
        (
          SELECT IFNULL(so.UNIT_PRICE, 0)
          FROM xxafmc_stock_out so
          WHERE so.item_code = xxafmc_inventory.ITEM_CODE
            AND IFNULL(so.STOCK_QUANTITY, 0) > 0
          ORDER BY so.CREATION_DATE DESC
          LIMIT 1
        ) AS stock_out_unit_price,
        (
          SELECT IFNULL(
            NULLIF(
              MAX(
                CASE
                  WHEN so.PEGS IS NULL OR so.PEGS = 0 THEN 1
                  ELSE so.PEGS
                END
              ),
              0
            ),
            1
          )
          FROM xxafmc_stock_out so
          WHERE so.item_code = xxafmc_inventory.ITEM_CODE
        ) AS pegs,
        (
          SELECT IFNULL(SUM(so.STOCK_QUANTITY), 0)
          FROM xxafmc_stock_out so
          WHERE so.item_code = xxafmc_inventory.ITEM_CODE
        ) AS actual_qty,
        (
          SELECT IFNULL(t.reserved_qty, 0)
          FROM xxafmc_stock_reservation_totals t
          WHERE t.item_code = xxafmc_inventory.ITEM_CODE
          LIMIT 1
        ) AS reserved_qty
      FROM xxafmc_inventory
      WHERE ITEM_CODE = ?
      LIMIT 1
    `,
    [itemCode]
  );

  return rows[0] || null;
}

function calculateOrderUnitPrice(inventoryItem, isNonMember) {
  const categoryId = Number(inventoryItem?.category_id || 0);
  const subCategory = Number(inventoryItem?.sub_category || 0);
  const inventoryBasePrice = Number(inventoryItem?.unit_price || 0);
  const stockUnitPrice = Number(inventoryItem?.stock_out_unit_price || 0);
  const inventoryUnitPrice = stockUnitPrice || inventoryBasePrice;
  const pegs = Math.max(Number(inventoryItem?.pegs || 1), 1);
  const profit = isNonMember
    ? Number(inventoryItem?.non_member_profit || 0)
    : Number(inventoryItem?.profit || 0);
  const charges = isNonMember
    ? Number(inventoryItem?.pr_charges || 0)
    : Number(inventoryItem?.food_pr_charges || 0);

  let finalPrice = inventoryUnitPrice;

  const isMocktailItem = categoryId === 10 && [14, 15].includes(subCategory);

  if (isMocktailItem) {
    finalPrice = inventoryBasePrice + charges;
  } else if (categoryId === 10 && isExcludedLiquorSubcategory(subCategory)) {
    finalPrice = inventoryUnitPrice / pegs;
  } else if (categoryId === 10) {
    const pricePerPeg = inventoryUnitPrice / pegs;
    finalPrice = pricePerPeg + (pricePerPeg * profit) / 100 + charges;
  } else if (categoryId === 14) {
    finalPrice = inventoryUnitPrice / pegs + charges;
  } else {
    finalPrice = inventoryBasePrice || inventoryUnitPrice;
  }

  return Number(finalPrice.toFixed(2));
}

function pickBestOffer(offerRows, quantity) {
  const qty = Number(quantity || 0);
  if (!Array.isArray(offerRows) || offerRows.length === 0 || !Number.isFinite(qty) || qty <= 0) {
    return null;
  }

  let best = null;
  let bestFreeQty = -1;

  for (const offer of offerRows) {
    const offerQty = Number(offer?.offer_quantity || 0);
    const freePer = Number(offer?.free_item_quantity || 0);
    const freeItemCode = Number(offer?.free_item_code || 0);
    if (!Number.isFinite(offerQty) || offerQty <= 0) continue;
    if (!Number.isFinite(freePer) || freePer <= 0) continue;
    if (!Number.isFinite(freeItemCode) || freeItemCode <= 0) continue;

    const computedFreeQty = Math.floor(qty / offerQty) * freePer;
    if (computedFreeQty <= 0) continue;

    const currentBestOfferQty = Number(best?.offer_quantity || 0);
    if (
      computedFreeQty > bestFreeQty ||
      (computedFreeQty === bestFreeQty && Number.isFinite(currentBestOfferQty) && offerQty < currentBestOfferQty) ||
      (computedFreeQty === bestFreeQty && !best)
    ) {
      best = offer;
      bestFreeQty = computedFreeQty;
    }
  }

  return best;
}

function pickUpcomingOffer(offerRows = []) {
  if (!Array.isArray(offerRows) || offerRows.length === 0) {
    return null;
  }

  let best = null;

  for (const offer of offerRows) {
    const offerQty = Number(offer?.offer_quantity || 0);
    const freePer = Number(offer?.free_item_quantity || 0);
    const freeItemCode = Number(offer?.free_item_code || 0);

    if (!Number.isFinite(offerQty) || offerQty <= 0) continue;
    if (!Number.isFinite(freePer) || freePer <= 0) continue;
    if (!Number.isFinite(freeItemCode) || freeItemCode <= 0) continue;

    const currentBestOfferQty = Number(best?.offer_quantity || 0);
    if (!best || offerQty < currentBestOfferQty) {
      best = offer;
    }
  }

  return best;
}

function computeFreeQtyForOffer(offer, quantity) {
  const qty = Number(quantity || 0);
  const offerQty = Number(offer?.offer_quantity || 0);
  const freePer = Number(offer?.free_item_quantity || 0);
  const freeItemCode = Number(offer?.free_item_code || 0);

  if (!Number.isFinite(qty) || qty <= 0) return 0;
  if (!Number.isFinite(offerQty) || offerQty <= 0) return 0;
  if (!Number.isFinite(freePer) || freePer <= 0) return 0;
  if (!Number.isFinite(freeItemCode) || freeItemCode <= 0) return 0;

  return Math.floor(qty / offerQty) * freePer;
}

const debugOffer = (...args) => {
  if (String(process.env.DEBUG_OFFERS || "").trim() === "1") {
    // console.log("[OFFERS]", ...args);
  }
};

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
        AND (
          (END_DATE IS NULL AND CURDATE() >= DATE(OFFER_DATE))
          OR (CURDATE() BETWEEN DATE(OFFER_DATE) AND END_DATE)
        )
        AND (status IS NULL OR UPPER(status) = UPPER('Active'))
      ORDER BY offer_id DESC
    `,
    [itemCode, quantity]
  );

  const picked = pickBestOffer(offerRows, quantity);
  debugOffer("getActiveOffer", { itemCode, quantity, offerRows, picked });
  return picked;
}

async function hasCocktailRecipe(connection, itemCode) {
  const [[recipeRow]] = await connection.execute(
    `
      SELECT 1 AS is_cocktail
      FROM xxafmc_cocktails_mocktails_details
      WHERE inventory_item_code = ?
      LIMIT 1
    `,
    [itemCode]
  );

  return Boolean(recipeRow);
}

async function syncFreeItemForOrderItem(
  connection,
  { orderNumber, itemCode, quantity, appUser, parentOrderLineId, reserveStock = false }
) {
  // console.log(`[SYNC-FREE] Called for order ${orderNumber}, item ${itemCode}:`, {
  //   quantity,
  //   parentOrderLineId,
  //   reserveStock
  // });

  const normalizedParentOrderLineId = Number(parentOrderLineId);
  if (!Number.isFinite(normalizedParentOrderLineId) || normalizedParentOrderLineId <= 0) {
    throw createValidationError("Unable to link free item to its order line");
  }
  const parentOrderLineKey = String(normalizedParentOrderLineId);

  const inventoryItem = await getInventoryItem(connection, itemCode);
  if (!inventoryItem) {
    throw createValidationError("Inventory item not found");
  }

  const subCategory = Number(inventoryItem.sub_category ?? 0);
  if ([14, 15].includes(subCategory) || await hasCocktailRecipe(connection, itemCode)) {
    // console.log(`[SYNC-FREE] Skipping - item is cocktail/mocktail`);
    return;
  }

  const pegMultiplier = getPegMultiplierForType(inventoryItem.type);
  const effectiveQuantity = quantity * pegMultiplier;
  const offer = await getActiveOffer(connection, itemCode, effectiveQuantity);
  
  // console.log(`[SYNC-FREE] Item ${itemCode} (${inventoryItem.type}, multiplier: ${pegMultiplier}):`, {
  //   quantity,
  //   effectiveQuantity,
  //   offer: offer?.offer_id || null,
  //   freeItemCode: offer?.free_item_code || null
  // });

  if (!offer) {
    // console.log(`[SYNC-FREE] No active offer, deleting free rows for parent ${parentOrderLineKey}`);
    await connection.execute(
      `
        DELETE FROM xxafmc_order_details
        WHERE order_id = ?
          AND barcode = ?
          AND price = 0
      `,
      [orderNumber, parentOrderLineKey]
    );
    return;
  }

  const offerQuantity = Number(offer.offer_quantity || 0);
  const freeItemQuantity = Number(offer.free_item_quantity || 0);
  const computedFreeQty =
    offerQuantity > 0 && freeItemQuantity > 0
      ? Math.floor((quantity * pegMultiplier) / offerQuantity) * freeItemQuantity
      : 0;

  // console.log(`[SYNC-FREE] Computed free quantity: ${computedFreeQty}`);

  const [existingFreeRows] = await connection.execute(
    `
      SELECT order_line_id, item_id, quantity
      FROM xxafmc_order_details
      WHERE order_id = ?
        AND item_id = ?
        AND barcode = ?
        AND price = 0
      ORDER BY order_line_id ASC
      LIMIT 1
    `,
    [orderNumber, offer.free_item_code, parentOrderLineKey]
  );

  const existingFreeRow = existingFreeRows[0] || null;

  if (computedFreeQty <= 0) {
    if (existingFreeRow) {
      // console.log(`[SYNC-FREE] Deleting existing free row ${existingFreeRow.order_line_id}`);
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

  const freeItemCode = Number(offer.free_item_code || 0);
  const currentExistingQty = Number(existingFreeRow?.quantity || 0);
  const freeQtyDelta = computedFreeQty - currentExistingQty;

  // console.log(`[SYNC-FREE] Free item ${freeItemCode}:`, {
  //   currentQty: currentExistingQty,
  //   newQty: computedFreeQty,
  //   delta: freeQtyDelta,
  //   reserveStock
  // });

  // Only validate stock for free items, don't reserve (reservation happens on completion)
  if (Number.isFinite(freeItemCode) && freeItemCode > 0 && freeQtyDelta > 0) {
    const [[freeStockRow]] = await connection.execute(
      `SELECT IFNULL(SUM(stock_quantity), 0) AS stock_qty
       FROM xxafmc_stock_out
       WHERE item_code = ?`,
      [freeItemCode]
    );
    
    // Get reserved from COMPLETED orders only
    const [[freeReservedRow]] = await connection.execute(
      `SELECT IFNULL(reserved_qty, 0) AS reserved_qty
       FROM xxafmc_stock_reservation_totals
       WHERE item_code = ?
       LIMIT 1`,
      [freeItemCode]
    );
    
    // Get this order's own consumption for the free item
    const directWeightedByCode = await getOrderDirectConsumptionByItemCode(connection, orderNumber);
    const ownLines = directWeightedByCode.get(String(freeItemCode)) || [];
    const ownConsumption = ownLines.reduce((sum, entry) => sum + entry.weighted, 0);
    
    const freeAvailableQty = Math.max(
      0,
      Number(freeStockRow?.stock_qty || 0) - 
      Number(freeReservedRow?.reserved_qty || 0) - 
      ownConsumption
    );
    
    if (freeQtyDelta > freeAvailableQty) {
      // // console.log(`[SYNC-FREE] ❌ Out of stock for free item: ${freeAvailableQty} available, ${freeQtyDelta} needed`);
      throw createValidationError(`Out of stock for free item. Available quantity: ${freeAvailableQty}`);
    }
  }

  // Delete any duplicate free lines tied to this exact parent line
  await connection.execute(
    `
      DELETE FROM xxafmc_order_details
      WHERE order_id = ?
        AND item_id = ?
        AND barcode = ?
        AND price = 0
        ${existingFreeRow ? `AND order_line_id != ?` : ''}
    `,
    existingFreeRow 
      ? [orderNumber, freeItemCode, parentOrderLineKey, existingFreeRow.order_line_id]
      : [orderNumber, freeItemCode, parentOrderLineKey]
  );

  if (existingFreeRow) {
    // // console.log(`[SYNC-FREE] Updating free row ${existingFreeRow.order_line_id} to ${computedFreeQty}`);
    await connection.execute(
      `
        UPDATE xxafmc_order_details
        SET quantity = ?,
            total_quantity = ?
        WHERE order_line_id = ?
      `,
      [computedFreeQty, quantity, existingFreeRow.order_line_id]
    );
  } else {
    // // console.log(`[SYNC-FREE] Creating new free row with quantity ${computedFreeQty}`);
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
            barcode,
            type
          )
        VALUES
          (?, ?, ?, ?, 0, 0, ?, ?, NOW(), ?, ?, ?)
      `,
      [
        freeOrderLineId,
        orderNumber,
        offer.free_item_code,
        computedFreeQty,
        quantity,
        appUser,
        Number(freeInventoryItem?.sub_category ?? subCategory),
        parentOrderLineKey,
        inventoryItem?.type || null
      ]
    );
  }
}

// Get reserved quantities from COMPLETED orders only (xxafmc_stock_reservation_totals)
// This table only has data for completed/confirmed orders
async function getReservedQuantitiesExcludingOrder(connection, itemCodes, orderNumber) {
  // // console.log(`[RESERVED-EXCLUDING] Called for order ${orderNumber}, items:`, itemCodes);

  const normalizedCodes = [...new Set((Array.isArray(itemCodes) ? itemCodes : [])
    .map((code) => Number(code))
    .filter((code) => Number.isFinite(code) && code > 0))];

  if (normalizedCodes.length === 0) return new Map();

  const placeholders = normalizedCodes.map(() => "?").join(",");

  // Get reserved totals from COMPLETED orders only
  const [totalsRows] = await connection.execute(
    `
      SELECT item_code, IFNULL(reserved_qty, 0) AS reserved_qty
      FROM xxafmc_stock_reservation_totals
      WHERE item_code IN (${placeholders})
    `,
    normalizedCodes
  );

  const result = totalsRows.reduce((map, row) => {
    map.set(String(row.item_code), Number(row.reserved_qty || 0));
    return map;
  }, new Map());

  // // console.log(`[RESERVED-EXCLUDING] Reserved from completed orders:`, Object.fromEntries(result));
  return result;
}

// Every direct order line (paid Small/Large + Free BOGO) for a given order,
// grouped by item_code, with each line's peg-weighted quantity.
async function getOrderDirectConsumptionByItemCode(connection, orderNumber) {
  // // console.log(`[DIRECT-CONSUMPTION] Getting direct consumption for order ${orderNumber}`);
  
  const normalizedOrderNumber = Number(orderNumber);
  if (!Number.isFinite(normalizedOrderNumber) || normalizedOrderNumber <= 0) {
    return new Map();
  }

  const [rows] = await connection.execute(
    `
      SELECT order_line_id, item_id AS item_code, quantity, price, subtotal, type
      FROM xxafmc_order_details
      WHERE order_id = ?
    `,
    [normalizedOrderNumber]
  );

  const map = new Map();
  for (const row of rows) {
    const code = String(row.item_code);
    const isFreeRow = Number(row.price || 0) === 0 && Number(row.subtotal || 0) === 0;
    const weighted = isFreeRow
      ? Number(row.quantity || 0)
      : Number(row.quantity || 0) * getPegMultiplierForType(row.type);
    if (!map.has(code)) map.set(code, []);
    map.get(code).push({ order_line_id: Number(row.order_line_id), weighted });
  }

  // // console.log(`[DIRECT-CONSUMPTION] Found ${rows.length} lines:`, Object.fromEntries(map));
  return map;
}

// Every cocktail/mocktail parent line in a given order, grouped by the
// ingredient item_code it consumes
async function getOrderIngredientConsumptionByItemCode(connection, orderNumber) {
  // // console.log(`[INGREDIENT-CONSUMPTION] Getting ingredient consumption for order ${orderNumber}`);
  
  const normalizedOrderNumber = Number(orderNumber);
  if (!Number.isFinite(normalizedOrderNumber) || normalizedOrderNumber <= 0) {
    return new Map();
  }

  const [rows] = await connection.execute(
    `
      SELECT
        x.inventory_item_code AS parent_item_id,
        x.item_code AS ingredient_item_code,
        x.pegs AS ingredient_pegs,
        x.quantity AS parent_quantity
      FROM (
        SELECT inventory_item_code, item_code, pegs, quantity
        FROM xxafmc_custom_cocktails_mocktails_details
        WHERE order_number = ?
        UNION ALL
        SELECT inventory_item_code, item_code, pegs, quantity
        FROM xxafmc_custom_cocktails_mocktails_details_dummy
        WHERE order_number = ?
      ) x
    `,
    [normalizedOrderNumber, normalizedOrderNumber]
  );

  const map = new Map();
  for (const row of rows) {
    const parentId = Number(row.parent_item_id);
    const ingredientCode = String(row.ingredient_item_code);
    const weighted = Number(row.ingredient_pegs || 0) * Number(row.parent_quantity || 0);
    if (!Number.isFinite(parentId) || parentId <= 0 || weighted <= 0) continue;
    if (!map.has(ingredientCode)) map.set(ingredientCode, []);
    map.get(ingredientCode).push({ parent_item_id: parentId, weighted });
  }

  // // console.log(`[INGREDIENT-CONSUMPTION] Found ${rows.length} ingredient rows:`, Object.fromEntries(map));
  return map;
}

async function getIngredientStockQuantities(connection, ingredientCodes) {
  const normalizedCodes = [...new Set((Array.isArray(ingredientCodes) ? ingredientCodes : [])
    .map((code) => Number(code))
    .filter((code) => Number.isFinite(code) && code > 0))];

  if (normalizedCodes.length === 0) return {};

  const placeholders = normalizedCodes.map(() => "?").join(",");
  const [stockOutRows] = await connection.execute(
    `
      SELECT item_code, IFNULL(SUM(stock_quantity), 0) AS stock_quantity
      FROM xxafmc_stock_out
      WHERE item_code IN (${placeholders})
      GROUP BY item_code
    `,
    normalizedCodes
  );

  return stockOutRows.reduce((acc, row) => {
    acc[String(row.item_code)] = Number(row.stock_quantity || 0);
    return acc;
  }, {});
}

async function getCocktailStockStatusMap(connection, orderNumber, cocktailItemIds, parentQuantityMap = new Map()) {
  // // console.log(`[COCKTAIL-STATUS] Getting stock status for cocktails:`, cocktailItemIds);
  
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
  
  // Get reserved from COMPLETED orders only
  const reservedMap = await getReservedQuantitiesExcludingOrder(connection, ingredientCodes, normalizedOrderNumber);

  // Get this order's own consumption
  const directWeightedByCode = await getOrderDirectConsumptionByItemCode(connection, normalizedOrderNumber);
  const ingredientWeightedByCode = await getOrderIngredientConsumptionByItemCode(connection, normalizedOrderNumber);

  // console.log(`[COCKTAIL-STATUS] Stock map:`, stockMap);
  // console.log(`[COCKTAIL-STATUS] Reserved from completed orders:`, Object.fromEntries(reservedMap));
  // console.log(`[COCKTAIL-STATUS] Direct consumption:`, Object.fromEntries(directWeightedByCode));
  // console.log(`[COCKTAIL-STATUS] Ingredient consumption:`, Object.fromEntries(ingredientWeightedByCode));

  const statusMap = new Map();

  for (const parentId of normalizedItems) {
    const ingredients = byParent.get(parentId) || [];
    if (ingredients.length === 0) continue;

    let failing = null;
    let maxPossibleQty = Infinity;
    const overrideParentQtyRaw = parentQuantityMap.get(parentId);
    const overrideParentQty = Number(overrideParentQtyRaw);
    
    // console.log(`[COCKTAIL-STATUS] Checking cocktail ${parentId} with ${ingredients.length} ingredients:`);
    
    for (const ingredient of ingredients) {
      const stockQuantity = Number(stockMap[String(ingredient.itemCode)] || 0);
      const reservedQuantity = Number(reservedMap.get(String(ingredient.itemCode)) || 0);

      const directConsumed = (directWeightedByCode.get(String(ingredient.itemCode)) || [])
        .reduce((sum, entry) => sum + entry.weighted, 0);
      const otherCocktailsConsumed = (ingredientWeightedByCode.get(String(ingredient.itemCode)) || [])
        .filter((entry) => entry.parent_item_id !== parentId)
        .reduce((sum, entry) => sum + entry.weighted, 0);

      const availableQuantity = Math.max(
        0,
        stockQuantity - reservedQuantity - directConsumed - otherCocktailsConsumed
      );
      const parentQty =
        Number.isFinite(overrideParentQty) && overrideParentQty > 0
          ? overrideParentQty
          : Number(ingredient.parentQuantity || 0);
      const requiredQuantity = Number(ingredient.pegs || 0) * parentQty;

      const perCocktailPegs = Number(ingredient.pegs || 0);
      if (perCocktailPegs > 0) {
        maxPossibleQty = Math.min(maxPossibleQty, Math.floor(availableQuantity / perCocktailPegs));
      }

      // console.log(`[COCKTAIL-STATUS]   Ingredient ${ingredient.itemName} (${ingredient.itemCode}):`, {
      //   stock: stockQuantity,
      //   reserved: reservedQuantity,
      //   directConsumed,
      //   otherCocktailsConsumed,
      //   available: availableQuantity,
      //   required: requiredQuantity,
      //   perPeg: perCocktailPegs,
      //   maxPossible: maxPossibleQty
      // });

      if (requiredQuantity > availableQuantity) {
        failing = {
          itemName: ingredient.itemName || String(ingredient.itemCode),
          availableQuantity,
        };
        // console.log(`[COCKTAIL-STATUS]   ❌ OUT OF STOCK: ${ingredient.itemName} needs ${requiredQuantity}, only ${availableQuantity} available`);
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

  // console.log(`[COCKTAIL-STATUS] Final status map:`, Object.fromEntries(statusMap));
  return statusMap;
}

async function getOrderSummary(orderNumber) {
  // console.log(`[ORDER-SUMMARY] Getting summary for order ${orderNumber}`);
  
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
        ( 
          SELECT ci.CART_ID
          FROM xxafmc_cart_items ci
          WHERE ci.user_id = (
            SELECT oh.user_id
            FROM xxafmc_order_header oh
            WHERE oh.order_num = xxod.order_id
            LIMIT 1
          )
            AND ci.item_id = xxod.item_id
          ORDER BY ci.CART_ID DESC
          LIMIT 1
        ) AS cart_id,
        xxod.ITEM_ID AS item_id,
        xxod.QUANTITY AS quantity,
        xxod.PRICE AS price,
        xxod.BARCODE AS barcode,
        xxod.TYPE AS type,
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
        ELSE (
        SELECT IFNULL(SUM(so.stock_quantity), 0)
        FROM xxafmc_stock_out so
          WHERE so.item_code = XXINV.ITEM_CODE
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
  
  // Get reserved from COMPLETED orders only
  const reservedMap = await getReservedQuantitiesExcludingOrder(db, itemCodes, normalizedOrderNumber);

  // console.log(`[ORDER-SUMMARY] Reserved from completed orders:`, Object.fromEntries(reservedMap));

  // Get this order's own consumption
  const directWeightedByCode = await getOrderDirectConsumptionByItemCode(db, normalizedOrderNumber);
  const ingredientWeightedByCode = await getOrderIngredientConsumptionByItemCode(db, normalizedOrderNumber);

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

  const offerRows = itemCodes.length
    ? (await db.execute(
        `
          SELECT
            ofr.item_code,
            ofr.offer_quantity,
            ofr.free_item_quantity,
            ofr.free_item_code,
            freeinv.item_name AS free_item_name,
            freeinv.image AS free_item_image
          FROM xxafmc_offers ofr
          LEFT JOIN xxafmc_inventory freeinv
            ON ofr.free_item_code = freeinv.item_code
          WHERE ofr.item_code IN (${itemCodes.map(() => "?").join(",")})
            AND (
              (ofr.END_DATE IS NULL AND CURDATE() >= DATE(ofr.OFFER_DATE))
              OR (CURDATE() BETWEEN DATE(ofr.OFFER_DATE) AND ofr.END_DATE)
            )
            AND (ofr.status IS NULL OR UPPER(ofr.status) = UPPER('Active'))
          ORDER BY ofr.item_code, ofr.offer_quantity DESC
        `,
        itemCodes
      ))[0]
    : [];

  const offersByItemCode = new Map();
  for (const offer of offerRows) {
    const code = Number(offer?.item_code);
    if (!Number.isFinite(code) || code <= 0) continue;
    if (!offersByItemCode.has(code)) offersByItemCode.set(code, []);
    offersByItemCode.get(code).push(offer);
  }

  const freeItemCodes = [...new Set(
    offerRows
      .map((offer) => Number(offer?.free_item_code))
      .filter((code) => Number.isFinite(code) && code > 0)
  )];
  const freeStockMap = await getIngredientStockQuantities(db, freeItemCodes);
  const freeReservedMap = await getReservedQuantitiesExcludingOrder(db, freeItemCodes, normalizedOrderNumber);

  const enrichedItems = itemRows.map((row) => {
    const subcategory = Number(row.subcategory || 0);
    const isCocktailItem = [14, 15].includes(subcategory);

    const reservedQuantity = Number(reservedMap.get(String(row.item_code)) || 0);
    const stockQuantity = row.stock_quantity == null ? null : Number(row.stock_quantity || 0);

    const siblingRows = directWeightedByCode.get(String(row.item_code)) || [];
    const currentLineWeighted = siblingRows
      .filter((s) => s.order_line_id === row.order_line_id)
      .reduce((sum, s) => sum + s.weighted, 0);
    const otherLinesWeighted = siblingRows
      .filter((s) => s.order_line_id !== row.order_line_id)
      .reduce((sum, s) => sum + s.weighted, 0);

    const ingredientConsumed = (ingredientWeightedByCode.get(String(row.item_code)) || [])
      .reduce((sum, entry) => sum + entry.weighted, 0);

    const availableQuantity =
      stockQuantity == null
        ? null
        : Math.max(
            0,
            stockQuantity - reservedQuantity - otherLinesWeighted - ingredientConsumed + currentLineWeighted
          );

    // console.log(`[ORDER-SUMMARY] Item ${row.item_code} (${row.type}):`, {
    //   stock: stockQuantity,
    //   reserved: reservedQuantity,
    //   otherLines: otherLinesWeighted,
    //   ingredientConsumed,
    //   available: availableQuantity
    // });

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

    const isFreeRow = Number(row.price || 0) === 0 && Number(row.subtotal || 0) === 0;
    const offer = !isFreeRow
      ? (
          pickBestOffer(offersByItemCode.get(Number(row.item_code)) || [], Number(row.quantity || 0)) ||
          pickUpcomingOffer(offersByItemCode.get(Number(row.item_code)) || [])
        )
      : null;
    const freeItemCode = Number(offer?.free_item_code || 0);
    const freeStockQuantity = Number(freeStockMap[String(freeItemCode)] || 0);
    const freeReservedQuantity = Number(freeReservedMap.get(String(freeItemCode)) || 0);
    const freeAvailableQuantity =
      Number.isFinite(freeItemCode) && freeItemCode > 0
        ? Math.max(0, freeStockQuantity - freeReservedQuantity)
        : null;
    const computedFreeQty = offer
      ? computeFreeQtyForOffer(
        offer,
        Number(row.quantity || 0) * getPegMultiplierForType(row.type)
      )
      : 0;
    return {
      ...row,
      RESERVED_QUANTITY: reservedQuantity,
      AVAILABLE_QUANTITY: normalizedAvailableQuantity,
      stock_status: stockStatus,
      stock_issue_message: stockIssueMessage,
      offer_quantity: offer?.offer_quantity || null,
      free_item_quantity: offer?.free_item_quantity || null,
      free_item_code: offer?.free_item_code || null,
      free_item_name: offer?.free_item_name || null,
      free_item_image: offer?.free_item_image || null,
      free_item_available_quantity: freeAvailableQuantity,
      computed_free_item_quantity: computedFreeQty,
      parent_order_line_id: null,
    };
  });

  const expectedFreeQtyByParentOrderLineId = new Map();
  for (const row of enrichedItems) {
    const isFreeRow = Number(row.price || 0) === 0 && Number(row.subtotal || 0) === 0;
    if (isFreeRow) continue;
    const parentOrderLineKey = String(row.order_line_id ?? "").trim();
    if (!parentOrderLineKey) continue;
    const expected = Number(row.computed_free_item_quantity || 0);
    if (!Number.isFinite(expected) || expected <= 0) continue;
    expectedFreeQtyByParentOrderLineId.set(parentOrderLineKey, expected);
  }

  const reconciledItems = enrichedItems.map((row) => {
    const isFreeRow = Number(row.price || 0) === 0 && Number(row.subtotal || 0) === 0;
    if (!isFreeRow) return row;
    const parentOrderLineKey = String(row.barcode || "").trim();
    if (!parentOrderLineKey) return row;
    const expected = expectedFreeQtyByParentOrderLineId.get(parentOrderLineKey);
    if (!Number.isFinite(Number(expected))) return row;
    return { ...row, quantity: Number(expected), parent_order_line_id: Number(parentOrderLineKey) || null };
  });

  // console.log(`[ORDER-SUMMARY] Final order summary:`, {
  //   orderNumber: normalizedOrderNumber,
  //   itemCount: reconciledItems.length,
  //   total: orderTotal
  // });

  return {
    header: {
      ...headerRows[0],
      item_id: itemIdRows[0]?.item_id || null,
      order_total: Number(orderTotal.toFixed(2)),
      food_pr_charges: foodPrCharges,
    },
    items: reconciledItems,
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
        SELECT order_num, user_id
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

async function updateOrderItemQuantity(orderNumber, itemCode, delta, authUser = {}, orderLineId = null) {
  const normalizedOrderNumber = Number(orderNumber);
  const normalizedItemCode = Number(itemCode);
  const normalizedDelta = Number(delta);
  const normalizedOrderLineId = orderLineId != null ? Number(orderLineId) : null;

  // console.log(`[UPDATE-ITEM] Updating order ${normalizedOrderNumber}, item ${normalizedItemCode}, delta ${normalizedDelta}`);

  if (!Number.isFinite(normalizedOrderNumber) || normalizedOrderNumber <= 0) {
    throw createValidationError("Valid order number is required");
  }

  if (!Number.isFinite(normalizedItemCode) || normalizedItemCode <= 0) {
    throw createValidationError("Valid item code is required");
  }

  if (![1, -1].includes(normalizedDelta)) {
    throw createValidationError("Valid quantity delta is required");
  }

  if (orderLineId != null && (!Number.isFinite(normalizedOrderLineId) || normalizedOrderLineId <= 0)) {
    throw createValidationError("Valid order line ID is required");
  }

  const appUser = authUser?.username || authUser?.user_name || "SYSTEM";
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const lineFilter = normalizedOrderLineId != null ? "AND order_line_id = ?" : "";
    const lineParams = normalizedOrderLineId != null
      ? [normalizedOrderNumber, normalizedItemCode, normalizedOrderLineId]
      : [normalizedOrderNumber, normalizedItemCode];

    const [[existingRow]] = await connection.execute(
      `
        SELECT order_line_id, item_id, quantity, subcategory, price, barcode, type
        FROM xxafmc_order_details
        WHERE order_id = ?
          AND item_id = ?
          AND (price IS NULL OR price <> 0)
          ${lineFilter}
        ORDER BY order_line_id ASC
        LIMIT 1
      `,
      lineParams
    );

    if (!existingRow) {
      const error = new Error("Order item not found");
      error.statusCode = 404;
      throw error;
    }

    if (
      normalizedOrderLineId == null &&
      await hasMultipleOrderLinesForItem(connection, normalizedOrderNumber, normalizedItemCode)
    ) {
      const error = new Error(
        "This item has more than one line in the order (different types). Please specify orderLineId."
      );
      error.statusCode = 409;
      throw error;
    }

    const currentQty = Number(existingRow.quantity || 0);
    const nextQty = currentQty + normalizedDelta;
    const itemSubCategory = Number(existingRow.subcategory ?? 0);
    const isMocktailItem = [14, 15].includes(itemSubCategory);
    const itemType = existingRow.type || "";

    // console.log(`[UPDATE-ITEM] Current qty: ${currentQty}, Next qty: ${nextQty}, Type: ${itemType}`);

    if (nextQty <= 0) {
      throw createValidationError("Quantity cannot be less than 1");
    }

    if (isMocktailItem && nextQty > 5) {
      throw createValidationError("Quantity must be 5 or less");
    }

    const pegMultiplier = getPegMultiplierForType(itemType);
    const currentUnits = currentQty * pegMultiplier;
    const nextUnits = nextQty * pegMultiplier;

    // console.log(`[UPDATE-ITEM] Units: current=${currentUnits}, next=${nextUnits}, multiplier=${pegMultiplier}`);

    if (!isMocktailItem) {
      if (normalizedDelta > 0) {
        const deltaUnits = nextUnits - currentUnits;
        // console.log(`[UPDATE-ITEM] Attempting to reserve ${deltaUnits} additional units`);
        await reserveInventoryQty(connection, normalizedItemCode, deltaUnits);
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
      parentOrderLineId: existingRow.order_line_id,
      reserveStock: false, // Don't reserve - only reserve on completion
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

async function deleteOrderItem(orderNumber, itemCode, orderLineId = null) {
  const normalizedOrderNumber = Number(orderNumber);
  const normalizedItemCode = Number(itemCode);
  const normalizedOrderLineId = orderLineId != null ? Number(orderLineId) : null;

  if (!Number.isFinite(normalizedOrderNumber) || normalizedOrderNumber <= 0) {
    throw createValidationError("Valid order number is required");
  }

  if (!Number.isFinite(normalizedItemCode) || normalizedItemCode <= 0) {
    throw createValidationError("Valid item code is required");
  }

  if (orderLineId != null && (!Number.isFinite(normalizedOrderLineId) || normalizedOrderLineId <= 0)) {
    throw createValidationError("Valid order line ID is required");
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const lineFilter = normalizedOrderLineId != null ? "AND order_line_id = ?" : "";
    const lineParams = normalizedOrderLineId != null
      ? [normalizedOrderNumber, normalizedItemCode, normalizedOrderLineId]
      : [normalizedOrderNumber, normalizedItemCode];

    const [[existingRow]] = await connection.execute(
      `
        SELECT order_line_id, item_id, quantity, subcategory
        FROM xxafmc_order_details
        WHERE order_id = ?
          AND item_id = ?
          AND (price IS NULL OR price <> 0)
          ${lineFilter}
        ORDER BY order_line_id ASC
        LIMIT 1
      `,
      lineParams
    );

    if (!existingRow) {
      const error = new Error("Order item not found");
      error.statusCode = 404;
      throw error;
    }

    if (
      normalizedOrderLineId == null &&
      await hasMultipleOrderLinesForItem(connection, normalizedOrderNumber, normalizedItemCode)
    ) {
      const error = new Error(
        "This item has more than one line in the order (different types). Please specify orderLineId."
      );
      error.statusCode = 409;
      throw error;
    }

    await connection.execute(
      `
        DELETE FROM xxafmc_order_details
        WHERE order_id = ?
          AND (order_line_id = ? OR (barcode = ? AND price = 0))
      `,
      [normalizedOrderNumber, existingRow.order_line_id, String(existingRow.order_line_id)]
    );

    if ([14, 15].includes(Number(existingRow.subcategory ?? 0))) {
      await connection.execute(
        `
          DELETE FROM xxafmc_custom_cocktails_mocktails_details
          WHERE order_number = ?
            AND inventory_item_code = ?
        `,
        [normalizedOrderNumber, normalizedItemCode]
      );

      await connection.execute(
        `
          DELETE FROM xxafmc_custom_cocktails_mocktails_details_dummy
          WHERE order_number = ?
            AND inventory_item_code = ?
        `,
        [normalizedOrderNumber, normalizedItemCode]
      );
    }

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
  // console.log(`[CREATE-ORDER] Creating order with payload:`, payload);
  
  const itemCode = Number(payload.itemCode);
  const rawQuantity = payload.quantity;
  const quantity = Number(rawQuantity || 1);
  const categoryId = Number(payload.categoryId);
  const remarks = String(payload.remarks || "").trim();
  const normalizedType = String(payload.type || "").trim() || null;
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
        SELECT user_id, role_id, login_type
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
    const isNonMember = usesNonMemberPricing({
      roleId: userRows[0].role_id,
      loginType: userRows[0].login_type,
    });

    const inventoryItem = await getInventoryItem(connection, itemCode);

    if (!inventoryItem) {
      const error = new Error("Inventory item not found");
      error.statusCode = 404;
      throw error;
    }

    let resolvedPubmed = null;
    if (pubmed !== null) {
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

    const resolvedCategoryId = Number.isFinite(categoryId) ? categoryId : Number(inventoryItem.category_id);
    const subCategory = Number(inventoryItem.sub_category ?? 0);
    const isMocktailItem = Number(resolvedCategoryId) === 10 && [14, 15].includes(subCategory);
    const isNonAlcoholicLiquorItem =
      Number(resolvedCategoryId) === 10 && isExcludedLiquorSubcategory(subCategory);
    const profit = isNonAlcoholicLiquorItem
      ? 0
      : isNonMember
        ? Number(inventoryItem.non_member_profit || 0)
        : Number(inventoryItem.profit || 0);
    const foodPrCharges = isNonAlcoholicLiquorItem
      ? 0
      : isNonMember
        ? Number(inventoryItem.pr_charges || 0)
        : Number(inventoryItem.food_pr_charges || 0);

    const unitPrice = calculateOrderUnitPrice(inventoryItem, isNonMember);
    const subtotal = Number((unitPrice * quantity).toFixed(2));

    if (isMocktailItem && quantity > 5) {
      throw createValidationError("Quantity must be 5 or less");
    }

    // Stock validation - check if enough stock exists (but DON'T reserve)
    if (!isMocktailItem) {
      const pegMultiplier = getPegMultiplierForType(normalizedType);
      const effectiveQuantity = quantity * pegMultiplier;
      const offer = await getActiveOffer(connection, itemCode, effectiveQuantity);
      const freeItemCode = Number(offer?.free_item_code || 0);
      const freeQuantity = offer
        ? computeFreeQtyForOffer(offer, effectiveQuantity)
        : 0;
      
      const [[stockRow]] = await connection.execute(
        `SELECT IFNULL(SUM(STOCK_QUANTITY), 0) AS stock_qty FROM xxafmc_stock_out WHERE item_code = ?`,
        [itemCode]
      );
      
      // Get reserved from COMPLETED orders only
      const [[resRow]] = await connection.execute(
        `SELECT IFNULL(reserved_qty, 0) AS reserved_qty FROM xxafmc_stock_reservation_totals WHERE item_code = ? LIMIT 1`,
        [itemCode]
      );
      
      const stockQty = Number(stockRow?.stock_qty || 0);
      const reservedQty = Number(resRow?.reserved_qty || 0);
      const availableQty = Math.max(0, stockQty - reservedQty);
      
      // A same-item BOGO consumes both the paid units and the free units.
      const requiredUnits = effectiveQuantity + (freeItemCode === itemCode ? freeQuantity : 0);
      
      // console.log(`[CREATE-ORDER] Stock validation for ${inventoryItem?.item_name}:`, {
      //   stockQty,
      //   reservedQty,
      //   availableQty,
      //   effectiveQuantity,
      //   freeQuantity,
      //   requiredUnits,
      //   pegMultiplier
      // });
      
      if (requiredUnits > availableQty) {
        const itemName = inventoryItem?.item_name || itemCode;
        const effectiveAvailableQty = pegMultiplier > 1 ? Math.floor(availableQty / pegMultiplier) : availableQty;
        // console.log(`[CREATE-ORDER] ❌ OUT OF STOCK: needed ${requiredUnits}, available ${availableQty}`);
        throw createValidationError(`Out of stock for ${itemName}. Available quantity: ${effectiveAvailableQty}`);
      }

      // DO NOT reserve stock here - reservation happens only on order completion
      // console.log(`[CREATE-ORDER] ✅ Stock validation passed - not reserving (will reserve on completion)`);
    }

    let typeId = null;
    if (Number(resolvedCategoryId) === 10 && normalizedType) {
      const [typeRows] = await connection.execute(
        `
          SELECT type_id
          FROM xxafmc_bar
          WHERE UPPER(type) = UPPER(?)
          LIMIT 1
        `,
        [normalizedType]
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
      [userId, memberId, resolvedPubmed, appUser]
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
          normalizedType,
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

    // Sync free items - but DON'T reserve stock (reserveStock: false)
    // console.log(`[CREATE-ORDER] Syncing free item with reserveStock=false`);
    await syncFreeItemForOrderItem(connection, {
      orderNumber,
      itemCode,
      quantity,
      appUser,
      parentOrderLineId: orderLineId,
      reserveStock: false, // Don't reserve - only reserve on completion
    });

    await connection.commit();

    // console.log(`[CREATE-ORDER] ✅ Order ${orderNumber} created successfully`);
    return {
      orderNumber,
      userId,
      orderDate: new Date().toISOString(),
    };
  } catch (error) {
    console.log(`[CREATE-ORDER] ❌ Error:`, error.message);
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateOrderLineQuantity(orderNumber, orderLineId, userId, quantity) {
  // console.log(`[UPDATE-LINE] Updating order ${orderNumber}, line ${orderLineId}, new quantity ${quantity}`);
  
  const normalizedOrderNumber = Number(orderNumber);
  const normalizedOrderLineId = Number(orderLineId);
  const normalizedUserId = Number(userId);
  const normalizedQuantity = Number(quantity);

  if (!Number.isFinite(normalizedOrderNumber) || normalizedOrderNumber <= 0) {
    const error = new Error("Valid Order number is required");
    error.statusCode = 400;
    throw error;
  }

  if (!Number.isFinite(normalizedOrderLineId) || normalizedOrderLineId <= 0) {
    const error = new Error("Valid Order line ID is required");
    error.statusCode = 400;
    throw error;
  }

  if (!Number.isFinite(normalizedUserId) || normalizedUserId <= 0) {
    const error = new Error("Valid User ID is required");
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
      `
        SELECT order_num, user_id
        FROM xxafmc_order_header
        WHERE order_num = ?
        LIMIT 1
      `,
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
        SELECT
          od.order_line_id,
          od.item_id,
          od.quantity,
          od.price,
          od.subtotal,
          od.subcategory,
          od.created_by,
          od.barcode,
          od.type
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

    const currentQty = Number(detailRow.quantity || 0);
    const currentSubtotal = Number(detailRow.subtotal || 0);

    // console.log(`[UPDATE-LINE] Line details:`, {
    //   itemId: detailRow.item_id,
    //   currentQty,
    //   requestedQuantity: normalizedQuantity,
    //   type: detailRow.type,
    //   subcategory: detailRow.subcategory,
    //   price: detailRow.price,
    //   subtotal: detailRow.subtotal
    // });

    const storedPrice = detailRow.price;
    const hasStoredPrice =
      storedPrice !== null &&
      storedPrice !== undefined &&
      storedPrice !== "";

    const price = hasStoredPrice ? Number(storedPrice) : Number.NaN;

    const unitPrice =
      Number.isFinite(price) && price >= 0
        ? price
        : currentQty > 0
          ? Number((currentSubtotal / currentQty).toFixed(2))
          : 0;

    const isFreeLine =
      Number(unitPrice || 0) === 0 &&
      Number(currentSubtotal || 0) === 0;

    if (isFreeLine) {
      const error = new Error("Free items cannot be updated");
      error.statusCode = 400;
      throw error;
    }

    const itemId = Number(detailRow.item_id);
    const itemType = detailRow.type || "";

    const itemSubcategory = Number(detailRow.subcategory || 0);
    
    // For non-cocktail items, check stock availability
    if (![14, 15].includes(itemSubcategory)) {
      // Get all rows for this item in the order
      const [sameItemRows] = await connection.execute(
        `
          SELECT order_line_id, quantity, price, subtotal, type
          FROM xxafmc_order_details
          WHERE order_id = ? AND item_id = ?
        `,
        [normalizedOrderNumber, itemId]
      );

      // Calculate projected demand after update
      const projectedDemand = sameItemRows.reduce((total, row) => {
        const rowQuantity = Number(row.quantity || 0);
        if (!Number.isFinite(rowQuantity) || rowQuantity <= 0) return total;

        const isFreeRow = Number(row.price || 0) === 0 && Number(row.subtotal || 0) === 0;
        if (Number(row.order_line_id) === normalizedOrderLineId) {
          // This is the line being updated - use the new quantity
          return total + normalizedQuantity * getPegMultiplierForType(row.type);
        }
        // Other lines - use their current quantity
        return total + (isFreeRow ? rowQuantity : rowQuantity * getPegMultiplierForType(row.type));
      }, 0);

      // console.log(`[UPDATE-LINE] Projected demand for item ${itemId}:`, {
      //   sameItemRows,
      //   projectedDemand,
      //   updatingLine: normalizedOrderLineId,
      //   newQuantity: normalizedQuantity
      // });

      // Get stock from inventory
      const stockMap = await getIngredientStockQuantities(connection, [itemId]);
      const stockQuantity = Number(stockMap[String(itemId)] || 0);

      // Get reserved from COMPLETED orders only
      const reservedMap = await getReservedQuantitiesExcludingOrder(
        connection,
        [itemId],
        normalizedOrderNumber
      );
      const reservedFromOtherOrders = Number(reservedMap.get(String(itemId)) || 0);

      // Get this order's OWN consumption (from xxafmc_order_details)
      const directWeightedByCode = await getOrderDirectConsumptionByItemCode(connection, normalizedOrderNumber);
      const ownLines = directWeightedByCode.get(String(itemId)) || [];
      // Exclude the line being updated from own consumption (we're already using projectedDemand)
      const ownConsumption = ownLines
        .filter(entry => entry.order_line_id !== normalizedOrderLineId)
        .reduce((sum, entry) => sum + entry.weighted, 0);

      // Get ingredient consumption from cocktails in this order
      const ingredientWeightedByCode = await getOrderIngredientConsumptionByItemCode(connection, normalizedOrderNumber);
      const ingredientConsumed = (ingredientWeightedByCode.get(String(itemId)) || [])
        .reduce((sum, entry) => sum + entry.weighted, 0);

      // Calculate actual available (stock - completed orders - this order's other lines - ingredients)
      const availableQuantity = Math.max(0, 
        stockQuantity - reservedFromOtherOrders - ownConsumption - ingredientConsumed
      );

      // console.log(`[UPDATE-LINE] Stock check:`, {
      //   stockQuantity,
      //   reservedFromOtherOrders,
      //   ownConsumption,
      //   ingredientConsumed,
      //   availableQuantity,
      //   projectedDemand
      // });

      // Check if projected demand exceeds available
      if (projectedDemand > availableQuantity) {
        // console.log(`[UPDATE-LINE] ❌ OUT OF STOCK: projected demand ${projectedDemand} > available ${availableQuantity}`);
        const error = new Error(`Out of stock. Available quantity: ${availableQuantity}`);
        error.statusCode = 400;
        throw error;
      }
    }

    const [[invRow]] = await connection.execute(
      `
        SELECT
          xi.item_name,
          xi.sub_category AS subcategory,
          IFNULL(xi.stock_quantity, 0) AS stock_quantity,
          IFNULL(xi.reserved_qty, 0) AS reserved_qty
        FROM xxafmc_inventory xi
        WHERE xi.item_code = ?
        LIMIT 1
      `,
      [itemId]
    );

    const inventorySubcategory = Number(invRow?.subcategory || 0);
    const isCocktailOrMocktail =
      [14, 15].includes(inventorySubcategory) ||
      await hasCocktailRecipe(connection, itemId);

    const pegMultiplier = getPegMultiplierForType(itemType);
    const currentUnits = currentQty * pegMultiplier;
    const newUnits = normalizedQuantity * pegMultiplier;

    // console.log(`[UPDATE-LINE] Units: current=${currentUnits}, new=${newUnits}, multiplier=${pegMultiplier}`);

    // For cocktail/mocktail items, check ingredient stock
    if (isCocktailOrMocktail) {
      // console.log(`[UPDATE-LINE] Checking cocktail stock status`);
      const statusMap = await getCocktailStockStatusMap(
        connection,
        normalizedOrderNumber,
        [itemId],
        new Map([[itemId, normalizedQuantity]])
      );

      const status = statusMap.get(itemId);

      if (
        String(status?.status || "").toLowerCase() === "out of stock"
      ) {
        // console.log(`[UPDATE-LINE] ❌ Cocktail out of stock:`, status?.message);
        const error = new Error(
          status?.message ||
            "Out of stock for cocktail/mocktail ingredients."
        );
        error.statusCode = 400;
        throw error;
      }
    } else {
      // For non-cocktail items, reserve the delta if increasing
      // This reserves stock for COMPLETED orders only
      const deltaUnits = newUnits - currentUnits;
      if (deltaUnits > 0) {
        // console.log(`[UPDATE-LINE] Reserving ${deltaUnits} additional units for completion`);
        await reserveInventoryQty(connection, itemId, deltaUnits);
      }
    }

    // Update the order line
    const updatedSubtotal = Number(
      (normalizedQuantity * unitPrice).toFixed(2)
    );

    await connection.execute(
      `
        UPDATE xxafmc_order_details
        SET quantity = ?,
            subtotal = ?
        WHERE order_id = ?
          AND order_line_id = ?
      `,
      [
        normalizedQuantity,
        updatedSubtotal,
        normalizedOrderNumber,
        normalizedOrderLineId,
      ]
    );

    // Update cocktail/mocktail details if applicable
    if (isCocktailOrMocktail) {
      await connection.execute(
        `
          UPDATE xxafmc_custom_cocktails_mocktails_details
          SET quantity = ?
          WHERE order_number = ?
            AND inventory_item_code = ?
        `,
        [normalizedQuantity, normalizedOrderNumber, itemId]
      );

      await connection.execute(
        `
          UPDATE xxafmc_custom_cocktails_mocktails_details_dummy
          SET quantity = ?
          WHERE order_number = ?
            AND inventory_item_code = ?
        `,
        [normalizedQuantity, normalizedOrderNumber, itemId]
      );
    }

    // Remove stale free rows for cocktails/mocktails
    if (isCocktailOrMocktail) {
      const [staleFreeRows] = await connection.execute(
        `
          SELECT item_id, quantity
          FROM xxafmc_order_details
          WHERE order_id = ?
            AND barcode = ?
            AND IFNULL(price, 0) = 0
            AND IFNULL(subtotal, 0) = 0
        `,
        [normalizedOrderNumber, String(normalizedOrderLineId)]
      );

      for (const staleFreeRow of staleFreeRows) {
        await releaseInventoryQty(
          connection,
          staleFreeRow.item_id,
          staleFreeRow.quantity
        );
      }

      await connection.execute(
        `
          DELETE FROM xxafmc_order_details
          WHERE order_id = ?
            AND barcode = ?
            AND IFNULL(price, 0) = 0
            AND IFNULL(subtotal, 0) = 0
        `,
        [normalizedOrderNumber, String(normalizedOrderLineId)]
      );
    }

    // Handle offers for non-cocktail items
    if (!isCocktailOrMocktail) {
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
            AND (
              (END_DATE IS NULL AND CURDATE() >= DATE(OFFER_DATE))
              OR
              (CURDATE() BETWEEN DATE(OFFER_DATE) AND END_DATE)
            )
            AND (status IS NULL OR UPPER(status) = UPPER('Active'))
          ORDER BY offer_id DESC
        `,
        [itemId]
      );

      const offer = pickBestOffer(offerRows, normalizedQuantity * pegMultiplier);
      
      if (offer) {
        const freeItemCode = Number(offer.free_item_code || 0);
        const computedFreeQty = computeFreeQtyForOffer(offer, normalizedQuantity * pegMultiplier);
        
        const oldComputedFreeQty = computeFreeQtyForOffer(offer, currentQty * pegMultiplier);
        
        const freeQtyDelta = computedFreeQty - oldComputedFreeQty;

        // console.log(`[UPDATE-LINE] Offer handling:`, {
        //   currentQty,
        //   normalizedQuantity,
        //   oldComputedFreeQty,
        //   computedFreeQty,
        //   freeQtyDelta
        // });

        // Validate stock for free item delta (but don't reserve yet)
        if (freeQtyDelta > 0 && Number.isFinite(freeItemCode) && freeItemCode > 0) {
          const [[freeInvRow]] = await connection.execute(
            `
              SELECT
                IFNULL(stock_quantity, 0) AS stock_quantity
              FROM xxafmc_inventory
              WHERE item_code = ?
              LIMIT 1
            `,
            [freeItemCode]
          );

          const freeStockQuantity = Number(freeInvRow?.stock_quantity || 0);
          
          // Get reserved from COMPLETED orders
          const freeReservedMap = await getReservedQuantitiesExcludingOrder(
            connection,
            [freeItemCode],
            normalizedOrderNumber
          );
          const freeReservedQuantity = Number(freeReservedMap.get(String(freeItemCode)) || 0);
          
          // Get this order's own consumption of the free item
          const directWeightedByCode = await getOrderDirectConsumptionByItemCode(connection, normalizedOrderNumber);
          const ownLines = directWeightedByCode.get(String(freeItemCode)) || [];
          const ownConsumption = ownLines
            .filter(entry => entry.order_line_id !== normalizedOrderLineId)
            .reduce((sum, entry) => sum + entry.weighted, 0);
          
          const freeAvailableQuantity = Math.max(0, 
            freeStockQuantity - freeReservedQuantity - ownConsumption
          );

          if (freeQtyDelta > freeAvailableQuantity) {
            // console.log(`[UPDATE-LINE] ❌ Out of stock for free item: ${freeAvailableQuantity} available`);
            const error = new Error(
              `Out of stock for free item. Available quantity: ${freeAvailableQuantity}`
            );
            error.statusCode = 400;
            throw error;
          }

          // Reserve the delta for the free item (for completion)
          // console.log(`[UPDATE-LINE] Reserving ${freeQtyDelta} units for free item (completion)`);
          await reserveInventoryQty(connection, freeItemCode, freeQtyDelta, "free item");
        }

        // Find existing free line for this parent
        const [freeLines] = await connection.execute(
          `
            SELECT
              order_line_id,
              quantity
            FROM xxafmc_order_details
            WHERE order_id = ?
              AND item_id = ?
              AND IFNULL(price, 0) = 0
              AND IFNULL(subtotal, 0) = 0
              AND barcode = ?
            ORDER BY order_line_id ASC
            LIMIT 1
          `,
          [
            normalizedOrderNumber,
            freeItemCode,
            String(normalizedOrderLineId),
          ]
        );

        const existingFreeLine = freeLines?.[0] || null;

        // Delete duplicate free lines
        await connection.execute(
          `
            DELETE FROM xxafmc_order_details
            WHERE order_id = ?
              AND item_id = ?
              AND IFNULL(price, 0) = 0
              AND IFNULL(subtotal, 0) = 0
              AND barcode = ?
              ${existingFreeLine ? `AND order_line_id != ?` : ''}
          `,
          existingFreeLine 
            ? [normalizedOrderNumber, freeItemCode, String(normalizedOrderLineId), existingFreeLine.order_line_id]
            : [normalizedOrderNumber, freeItemCode, String(normalizedOrderLineId)]
        );

        // Update or insert free line
        if (computedFreeQty > 0 && Number.isFinite(freeItemCode) && freeItemCode > 0) {
          if (existingFreeLine) {
            await connection.execute(
              `
                UPDATE xxafmc_order_details
                SET quantity = ?,
                    total_quantity = ?
                WHERE order_line_id = ?
              `,
              [
                computedFreeQty,
                normalizedQuantity,
                existingFreeLine.order_line_id,
              ]
            );
          } else {
            const freeOrderLineId = await getNextOrderLineId(connection);
            const freeInventoryItem = await getInventoryItem(connection, freeItemCode);

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
                  barcode,
                  type
                )
                VALUES
                (
                  ?, ?, ?, ?, 0, 0,
                  ?, ?, NOW(), ?, ?, ?
                )
              `,
              [
                freeOrderLineId,
                normalizedOrderNumber,
                freeItemCode,
                computedFreeQty,
                normalizedQuantity,
                detailRow.created_by || String(normalizedUserId),
                freeInventoryItem?.sub_category ?? null,
                String(normalizedOrderLineId),
                itemType || null
              ]
            );
          }
        } else {
          if (existingFreeLine) {
            await connection.execute(
              `
                DELETE FROM xxafmc_order_details
                WHERE order_id = ?
                  AND order_line_id = ?
              `,
              [normalizedOrderNumber, existingFreeLine.order_line_id]
            );
          }
        }
      } else {
        // No offer - delete any existing free item
        await connection.execute(
          `
            DELETE FROM xxafmc_order_details
            WHERE order_id = ?
              AND barcode = ?
              AND IFNULL(price, 0) = 0
              AND IFNULL(subtotal, 0) = 0
          `,
          [normalizedOrderNumber, String(normalizedOrderLineId)]
        );
      }
    }

    await connection.commit();
    // console.log(`[UPDATE-LINE] ✅ Order ${normalizedOrderNumber} updated successfully`);
    return await getOrderSummary(normalizedOrderNumber);
  } catch (error) {
    // console.log(`[UPDATE-LINE] ❌ Error:`, error.message);
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateOrderItemCustomization(orderNumber, itemCode, userId, ingredients, authUser = {}) {
  const normalizedOrderNumber = Number(orderNumber);
  const normalizedItemCode = Number(itemCode);
  const normalizedUserId = Number(userId);

  if (!Number.isFinite(normalizedOrderNumber) || normalizedOrderNumber <= 0) {
    throw createValidationError("Valid order number is required");
  }

  if (!Number.isFinite(normalizedItemCode) || normalizedItemCode <= 0) {
    throw createValidationError("Valid item code is required");
  }

  if (!Number.isFinite(normalizedUserId) || normalizedUserId <= 0) {
    throw createValidationError("User ID is required");
  }

  const normalizedIngredients = (Array.isArray(ingredients) ? ingredients : [])
    .map((ingredient) => ({
      itemCode: Number(ingredient?.itemCode ?? ingredient?.ITEM_CODE),
      itemName: String(ingredient?.itemName ?? ingredient?.ITEM_NAME ?? "").trim(),
      quantity: Number(ingredient?.quantity ?? ingredient?.QUANTITY ?? ingredient?.pegs ?? ingredient?.PEGS),
      unitPrice:
        ingredient?.unitPrice !== undefined && ingredient?.unitPrice !== null && ingredient?.unitPrice !== ""
          ? Number(ingredient.unitPrice)
          : null,
      lineTotal:
        ingredient?.lineTotal !== undefined && ingredient?.lineTotal !== null && ingredient?.lineTotal !== ""
          ? Number(ingredient.lineTotal)
          : null,
    }))
    .filter((ingredient) =>
      Number.isFinite(ingredient.itemCode) &&
      ingredient.itemCode > 0 &&
      Number.isFinite(ingredient.quantity) &&
      ingredient.quantity > 0
    );

  if (normalizedIngredients.length === 0) {
    throw createValidationError("At least one valid ingredient is required");
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [[orderRow]] = await connection.execute(
      `
        SELECT oh.user_id, od.quantity, od.subcategory
        FROM xxafmc_order_header oh
        INNER JOIN xxafmc_order_details od
          ON od.order_id = oh.order_num
        WHERE oh.order_num = ?
          AND oh.user_id = ?
          AND od.item_id = ?
          AND NOT (IFNULL(od.price, 0) = 0 AND IFNULL(od.subtotal, 0) = 0)
        LIMIT 1
      `,
      [normalizedOrderNumber, normalizedUserId, normalizedItemCode]
    );

    if (!orderRow) {
      const error = new Error("Order item not found");
      error.statusCode = 404;
      throw error;
    }

    if (![14, 15].includes(Number(orderRow.subcategory))) {
      throw createValidationError("Order item is not a cocktail or mocktail");
    }

    const ingredientCodes = [...new Set(normalizedIngredients.map((ingredient) => ingredient.itemCode))];
    const placeholders = ingredientCodes.map(() => "?").join(",");
    const [inventoryRows] = await connection.execute(
      `
        SELECT item_code, item_name, unit_price
        FROM xxafmc_inventory
        WHERE item_code IN (${placeholders})
      `,
      ingredientCodes
    );

    const inventoryMap = inventoryRows.reduce((map, row) => {
      map.set(Number(row.item_code), row);
      return map;
    }, new Map());

    await connection.execute(
      `
        DELETE FROM xxafmc_custom_cocktails_mocktails_details
        WHERE order_number = ?
          AND inventory_item_code = ?
      `,
      [normalizedOrderNumber, normalizedItemCode]
    );

    await connection.execute(
      `
        DELETE FROM xxafmc_custom_cocktails_mocktails_details_dummy
        WHERE order_number = ?
          AND inventory_item_code = ?
      `,
      [normalizedOrderNumber, normalizedItemCode]
    );

    const parentQuantity = Number(orderRow.quantity || 1);
    const createdBy = authUser?.username || authUser?.user_name || String(normalizedUserId);
    let customUnitTotal = 0;

    for (const ingredient of normalizedIngredients) {
      const inventoryRow = inventoryMap.get(ingredient.itemCode);
      const itemName = inventoryRow?.item_name || ingredient.itemName || String(ingredient.itemCode);
      const unitPrice = Number.isFinite(ingredient.unitPrice)
        ? ingredient.unitPrice
        : Number(inventoryRow?.unit_price || 0);
      const lineTotal = Number.isFinite(ingredient.lineTotal)
        ? ingredient.lineTotal
        : unitPrice * ingredient.quantity;

      customUnitTotal += Number(lineTotal || 0);

      await connection.execute(
        `
          INSERT INTO xxafmc_custom_cocktails_mocktails_details
            (item_code, item_name, pegs, inventory_item_code, user_id, quantity, order_number, created_by, creation_date)
          VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `,
        [
          ingredient.itemCode,
          itemName,
          ingredient.quantity,
          normalizedItemCode,
          normalizedUserId,
          parentQuantity,
          normalizedOrderNumber,
          createdBy,
        ]
      );
    }

    if (customUnitTotal > 0) {
      await connection.execute(
        `
          UPDATE xxafmc_order_details
          SET price = ?,
              subtotal = ROUND(? * quantity, 2)
          WHERE order_id = ?
            AND item_id = ?
            AND NOT (IFNULL(price, 0) = 0 AND IFNULL(subtotal, 0) = 0)
        `,
        [
          Number(customUnitTotal.toFixed(2)),
          Number(customUnitTotal.toFixed(2)),
          normalizedOrderNumber,
          normalizedItemCode,
        ]
      );
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
  reserveInventoryQty,
  createOrder,
  getOrderSummary,
  cancelOrder,
  updateOrderItemQuantity,
  deleteOrderItem,
  updateOrderLineQuantity,
  updateOrderItemCustomization,
};