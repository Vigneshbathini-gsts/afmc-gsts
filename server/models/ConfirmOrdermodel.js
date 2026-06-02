const db = require("../config/db");

function normalizeKitchenType(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "BAR") {
    return "Bar";
  }
  return "Kitchen";
}

function deriveKitchenTypeFromCategory(categoryName) {
  const normalized = String(categoryName || "").trim().toUpperCase();
  return normalized === "LIQUOR" ? "Bar" : "Kitchen";
}

async function getIngredientStockQuantities(connection, ingredientCodes) {
  const normalizedCodes = [...new Set((Array.isArray(ingredientCodes) ? ingredientCodes : [])
    .map((code) => Number(code))
    .filter((code) => Number.isFinite(code) && code > 0))];

  if (normalizedCodes.length === 0) return {};

  const placeholders = normalizedCodes.map(() => "?").join(",");
  const [invRows] = await connection.execute(
    `
      SELECT item_code, IFNULL(stock_quantity, 0) AS stock_quantity
      FROM xxafmc_inventory
      WHERE item_code IN (${placeholders})
    `,
    normalizedCodes
  );

  const inventoryMap = invRows.reduce((acc, row) => {
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

async function getIngredientReservedQuantitiesExcludingOrder(connection, ingredientCodes, orderNumber) {
  const normalizedCodes = [...new Set((Array.isArray(ingredientCodes) ? ingredientCodes : [])
    .map((code) => Number(code))
    .filter((code) => Number.isFinite(code) && code > 0))];

  if (normalizedCodes.length === 0) return {};

  const placeholders = normalizedCodes.map(() => "?").join(",");
  const [rows] = await connection.execute(
    `
      SELECT item_code, IFNULL(reserved_qty, 0) AS reserved_quantity
      FROM xxafmc_stock_reservation_totals
      WHERE item_code IN (${placeholders})
    `,
    normalizedCodes
  );

  return rows.reduce((acc, row) => {
    acc[String(row.item_code)] = Number(row.reserved_quantity || 0);
    return acc;
  }, {});
}

async function getCocktailMaxQuantityMap(connection, orderNumber, parentItemIds) {
  const normalizedOrderNumber = Number(orderNumber);
  const normalizedParents = [...new Set((Array.isArray(parentItemIds) ? parentItemIds : [])
    .map((code) => Number(code))
    .filter((code) => Number.isFinite(code) && code > 0))];

  if (!Number.isFinite(normalizedOrderNumber) || normalizedOrderNumber <= 0 || normalizedParents.length === 0) {
    return new Map();
  }

  const placeholders = normalizedParents.map(() => "?").join(",");
  const [rows] = await connection.execute(
    `
      SELECT
        x.inventory_item_code AS parent_item_id,
        x.item_code AS ingredient_item_code,
        x.item_name AS ingredient_name,
        x.pegs AS ingredient_pegs
      FROM (
        SELECT inventory_item_code, item_code, item_name, pegs
        FROM xxafmc_custom_cocktails_mocktails_details
        WHERE order_number = ?
        UNION ALL
        SELECT inventory_item_code, item_code, item_name, pegs
        FROM xxafmc_custom_cocktails_mocktails_details_dummy
        WHERE order_number = ?
      ) x
      WHERE x.inventory_item_code IN (${placeholders})
    `,
    [normalizedOrderNumber, normalizedOrderNumber, ...normalizedParents]
  );

  const byParent = rows.reduce((acc, row) => {
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

  const ingredientCodes = [...new Set(rows
    .map((row) => Number(row.ingredient_item_code))
    .filter((code) => Number.isFinite(code) && code > 0))];

  const stockMap = await getIngredientStockQuantities(connection, ingredientCodes);
  const reservedMap = await getIngredientReservedQuantitiesExcludingOrder(connection, ingredientCodes, normalizedOrderNumber);

  const maxMap = new Map();

  for (const parentId of normalizedParents) {
    const ingredients = byParent.get(parentId) || [];
    if (ingredients.length === 0) {
      maxMap.set(parentId, null);
      continue;
    }

    let maxPossibleQty = Infinity;
    for (const ingredient of ingredients) {
      const perCocktailPegs = Number(ingredient.pegs || 0);
      if (perCocktailPegs <= 0) continue;
      const stockQuantity = Number(stockMap[String(ingredient.itemCode)] || 0);
      const reservedQuantity = Number(reservedMap[String(ingredient.itemCode)] || 0);
      const availableQuantity = Math.max(0, stockQuantity - reservedQuantity);
      maxPossibleQty = Math.min(maxPossibleQty, Math.floor(availableQuantity / perCocktailPegs));
    }

    maxMap.set(parentId, Number.isFinite(maxPossibleQty) ? Math.max(0, maxPossibleQty) : null);
  }

  return maxMap;
}

function normalizeCocktailCustomizations(payload) {
  const rawCustomizations =
    Array.isArray(payload?.cocktailCustomizations)
      ? payload.cocktailCustomizations
      : Array.isArray(payload?.customizations)
        ? payload.customizations
        : [];

  return rawCustomizations
    .map((customization) => {
      const parentItemCode = Number(
        customization?.itemCode ??
        customization?.ITEM_CODE ??
        customization?.parentItemCode ??
        customization?.inventoryItemCode
      );

      const ingredients = (Array.isArray(customization?.ingredients) ? customization.ingredients : [])
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

      if (!Number.isFinite(parentItemCode) || parentItemCode <= 0 || ingredients.length === 0) {
        return null;
      }

      return { parentItemCode, ingredients };
    })
    .filter(Boolean);
}

function pickBestOfferForQuantity(offers, quantity) {
  const qty = Number(quantity || 0);
  if (!Number.isFinite(qty) || qty <= 0) return null;

  return (Array.isArray(offers) ? offers : [])
    .filter((offer) => {
      const offerQty = Number(offer?.offer_quantity || 0);
      const freeQty = Number(offer?.free_item_quantity || 0);
      const freeCode = Number(offer?.free_item_code || 0);
      return offerQty > 0 && offerQty <= qty && freeQty > 0 && freeCode > 0;
    })
    .sort((a, b) => Number(b.offer_quantity || 0) - Number(a.offer_quantity || 0))[0] || null;
}

async function getNextOrderLineId(connection) {
  const [[row]] = await connection.execute(
    `SELECT COALESCE(MAX(order_line_id), 0) + 1 AS nextId FROM xxafmc_order_details`
  );
  return Number(row?.nextId || 1);
}

async function syncOfferFreeItemsForOrder(connection, orderNumber, createdBy) {
  const [paidRows] = await connection.execute(
    `
      SELECT
        od.order_line_id,
        od.item_id,
        od.quantity,
        od.subcategory,
        od.created_by,
        xi.sub_category
      FROM xxafmc_order_details od
      JOIN xxafmc_inventory xi
        ON xi.item_code = od.item_id
      WHERE od.order_id = ?
        AND NOT (IFNULL(od.price, 0) = 0 AND IFNULL(od.subtotal, 0) = 0)
      ORDER BY od.order_line_id ASC
    `,
    [orderNumber]
  );

  const parentCodes = [...new Set(
    paidRows
      .filter((row) => ![14, 15].includes(Number(row.sub_category ?? row.subcategory)))
      .map((row) => Number(row.item_id))
      .filter((code) => Number.isFinite(code) && code > 0)
  )];

  if (parentCodes.length === 0) return;

  const [offerRows] = await connection.execute(
    `
      SELECT item_code, offer_quantity, free_item_quantity, free_item_code
      FROM xxafmc_offers
      WHERE item_code IN (${parentCodes.map(() => "?").join(",")})
        AND (
          (end_date IS NULL AND CURDATE() >= DATE(offer_date))
          OR (CURDATE() BETWEEN DATE(offer_date) AND end_date)
        )
        AND (status IS NULL OR UPPER(status) = 'ACTIVE')
      ORDER BY item_code, offer_quantity DESC
    `,
    parentCodes
  );

  const offersByItemCode = new Map();
  for (const offer of offerRows) {
    const code = Number(offer?.item_code || 0);
    if (!Number.isFinite(code) || code <= 0) continue;
    if (!offersByItemCode.has(code)) offersByItemCode.set(code, []);
    offersByItemCode.get(code).push(offer);
  }

  for (const parent of paidRows) {
    const parentCode = Number(parent.item_id || 0);
    if (!Number.isFinite(parentCode) || parentCode <= 0) continue;
    if ([14, 15].includes(Number(parent.sub_category ?? parent.subcategory))) continue;

    const offer = pickBestOfferForQuantity(
      offersByItemCode.get(parentCode) || [],
      Number(parent.quantity || 0)
    );

    if (!offer) {
      await connection.execute(
        `
          DELETE FROM xxafmc_order_details
          WHERE order_id = ?
            AND barcode = ?
            AND IFNULL(price, 0) = 0
            AND IFNULL(subtotal, 0) = 0
        `,
        [orderNumber, String(parentCode)]
      );
      continue;
    }

    const offerQty = Number(offer.offer_quantity || 0);
    const freeQty = Number(offer.free_item_quantity || 0);
    const freeItemCode = Number(offer.free_item_code || 0);
    const computedFreeQty = offerQty > 0 ? Math.floor(Number(parent.quantity || 0) / offerQty) * freeQty : 0;

    const [freeRows] = await connection.execute(
      `
        SELECT order_line_id, quantity
        FROM xxafmc_order_details
        WHERE order_id = ?
          AND item_id = ?
          AND barcode = ?
          AND IFNULL(price, 0) = 0
          AND IFNULL(subtotal, 0) = 0
        ORDER BY order_line_id ASC
      `,
      [orderNumber, freeItemCode, String(parentCode)]
    );

    const canonicalFreeRow = freeRows[0] || null;
    const duplicateFreeRows = freeRows.slice(1);

    if (duplicateFreeRows.length > 0) {
      await connection.execute(
        `
          DELETE FROM xxafmc_order_details
          WHERE order_id = ?
            AND order_line_id IN (${duplicateFreeRows.map(() => "?").join(",")})
        `,
        [orderNumber, ...duplicateFreeRows.map((row) => Number(row.order_line_id))]
      );
    }

    if (computedFreeQty <= 0) {
      if (canonicalFreeRow?.order_line_id) {
        await connection.execute(
          `DELETE FROM xxafmc_order_details WHERE order_id = ? AND order_line_id = ?`,
          [orderNumber, Number(canonicalFreeRow.order_line_id)]
        );
      }
      continue;
    }

    if (canonicalFreeRow?.order_line_id) {
      await connection.execute(
        `
          UPDATE xxafmc_order_details
          SET quantity = ?,
              total_quantity = ?
          WHERE order_id = ?
            AND order_line_id = ?
        `,
        [computedFreeQty, Number(parent.quantity || 0), orderNumber, Number(canonicalFreeRow.order_line_id)]
      );
      continue;
    }

    const [[freeInventoryRow]] = await connection.execute(
      `SELECT sub_category FROM xxafmc_inventory WHERE item_code = ? LIMIT 1`,
      [freeItemCode]
    );
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
        freeItemCode,
        computedFreeQty,
        Number(parent.quantity || 0),
        parent.created_by || createdBy,
        freeInventoryRow?.sub_category ?? parent.subcategory ?? null,
        String(parentCode),
      ]
    );
  }
}

async function applyCocktailCustomizations(connection, {
  orderNumber,
  userId,
  createdBy,
  detailRows,
  payload,
}) {
  const customizations = normalizeCocktailCustomizations(payload);
  if (customizations.length === 0) return;

  const cocktailRowsByItemCode = new Map(
    (Array.isArray(detailRows) ? detailRows : [])
      .filter((row) => [14, 15].includes(Number(row.sub_category)))
      .map((row) => [Number(row.item_id), row])
  );

  const ingredientCodes = [
    ...new Set(
      customizations
        .flatMap((customization) => customization.ingredients.map((ingredient) => ingredient.itemCode))
        .filter((code) => Number.isFinite(code) && code > 0)
    ),
  ];

  let inventoryNameByCode = new Map();
  if (ingredientCodes.length > 0) {
    const placeholders = ingredientCodes.map(() => "?").join(",");
    const [inventoryRows] = await connection.execute(
      `
        SELECT item_code, item_name
        FROM xxafmc_inventory
        WHERE item_code IN (${placeholders})
      `,
      ingredientCodes
    );
    inventoryNameByCode = inventoryRows.reduce((map, row) => {
      map.set(Number(row.item_code), String(row.item_name || "").trim());
      return map;
    }, new Map());
  }

  for (const customization of customizations) {
    const parentRow = cocktailRowsByItemCode.get(customization.parentItemCode);
    if (!parentRow) {
      const error = new Error("Invalid cocktail/mocktail customization for this order");
      error.statusCode = 400;
      throw error;
    }

    await connection.execute(
      `
        DELETE FROM xxafmc_custom_cocktails_mocktails_details
        WHERE order_number = ?
          AND inventory_item_code = ?
      `,
      [orderNumber, customization.parentItemCode]
    );

    await connection.execute(
      `
        DELETE FROM xxafmc_custom_cocktails_mocktails_details_dummy
        WHERE order_number = ?
          AND inventory_item_code = ?
      `,
      [orderNumber, customization.parentItemCode]
    );

    for (const ingredient of customization.ingredients) {
      const itemName =
        inventoryNameByCode.get(ingredient.itemCode) ||
        ingredient.itemName ||
        String(ingredient.itemCode);

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
          customization.parentItemCode,
          userId,
          Number(parentRow.quantity || 1),
          orderNumber,
          createdBy,
        ]
      );
    }

    const customUnitTotal = customization.ingredients.reduce((sum, ingredient) => {
      const lineTotal = Number(ingredient.lineTotal);
      if (Number.isFinite(lineTotal) && lineTotal >= 0) {
        return sum + lineTotal;
      }

      const unitPrice = Number(ingredient.unitPrice);
      if (Number.isFinite(unitPrice) && unitPrice >= 0) {
        return sum + unitPrice * Number(ingredient.quantity || 0);
      }

      return sum;
    }, 0);

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
          orderNumber,
          customization.parentItemCode,
        ]
      );
    }
  }
}

async function syncCocktailCustomizationQuantities(connection, orderNumber) {
  await connection.execute(
    `
      UPDATE xxafmc_custom_cocktails_mocktails_details c
      JOIN xxafmc_order_details od
        ON od.order_id = c.order_number
        AND od.item_id = c.inventory_item_code
        AND NOT (IFNULL(od.price, 0) = 0 AND IFNULL(od.subtotal, 0) = 0)
      SET c.quantity = od.quantity
      WHERE c.order_number = ?
    `,
    [orderNumber]
  );

  await connection.execute(
    `
      UPDATE xxafmc_custom_cocktails_mocktails_details_dummy c
      JOIN xxafmc_order_details od
        ON od.order_id = c.order_number
        AND od.item_id = c.inventory_item_code
        AND NOT (IFNULL(od.price, 0) = 0 AND IFNULL(od.subtotal, 0) = 0)
      SET c.quantity = od.quantity
      WHERE c.order_number = ?
    `,
    [orderNumber]
  );
}

async function confirmOrder(orderNumber, authUser = {}, payload = {}) {
  const normalizedOrderNumber = Number(orderNumber);
  if (!Number.isFinite(normalizedOrderNumber) || normalizedOrderNumber <= 0) {
    const error = new Error("Valid order number is required");
    error.statusCode = 400;
    throw error;
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const lockReservationTotal = async (itemCode) => {
      const normalized = Number(itemCode);
      if (!Number.isFinite(normalized) || normalized <= 0) return;
      await connection.execute(
        `INSERT IGNORE INTO xxafmc_stock_reservation_totals (item_code, reserved_qty) VALUES (?, 0)`,
        [normalized]
      );
      await connection.execute(
        `SELECT item_code FROM xxafmc_stock_reservation_totals WHERE item_code = ? LIMIT 1 FOR UPDATE`,
        [normalized]
      );
    };

    const reserveTotalsQty = async (itemCode, quantity) => {
      const normalized = Number(itemCode);
      const qty = Number(quantity || 0);
      if (!Number.isFinite(normalized) || normalized <= 0) return;
      if (!Number.isFinite(qty) || qty <= 0) return;
      await connection.execute(
        `
          UPDATE xxafmc_stock_reservation_totals
          SET reserved_qty = IFNULL(reserved_qty, 0) + ?
          WHERE item_code = ?
          LIMIT 1
        `,
        [qty, normalized]
      );
    };

    const deductStockOutFifo = async (itemCode, requiredQuantity) => {
      const normalizedItemCode = Number(itemCode);
      let remaining = Number(requiredQuantity || 0);

      if (!Number.isFinite(normalizedItemCode) || normalizedItemCode <= 0) return;
      if (!Number.isFinite(remaining) || remaining <= 0) return;

      // MySQL tables do not have Oracle ROWID. `xxafmc_stock_out` also has no primary key,
      // so we perform FIFO by repeatedly selecting the oldest positive-stock row and updating
      // it using a multi-column match + LIMIT 1.
      while (remaining > 0) {
        const [[row]] = await connection.execute(
          `
            SELECT
              ITEM_ID AS item_id,
              ITEM_CODE AS item_code,
              STOCK_QUANTITY AS stock_quantity,
              CREATION_DATE AS creation_date
            FROM xxafmc_stock_out
            WHERE ITEM_CODE = ?
              AND IFNULL(STOCK_QUANTITY, 0) > 0
            ORDER BY ITEM_ID, CREATION_DATE ASC
            LIMIT 1
          `,
          [normalizedItemCode]
        );

        if (!row) break;

        const available = Number(row.stock_quantity || 0);
        if (available <= 0) break;

        const consumeQty = available >= remaining ? remaining : available;
        const nextQty = available - consumeQty;

        await connection.execute(
          `
            UPDATE xxafmc_stock_out
            SET STOCK_QUANTITY = ?
            WHERE ITEM_CODE = ?
              AND (CREATION_DATE <=> ?)
              AND (ITEM_ID <=> ?)
              AND IFNULL(STOCK_QUANTITY, 0) = ?
            LIMIT 1
          `,
          [nextQty, normalizedItemCode, row.creation_date ?? null, row.item_id ?? null, available]
        );

        remaining -= consumeQty;
      }
    };

    const [orderHeaderRows] = await connection.execute(
      `
        SELECT order_num, user_id, order_date
        FROM xxafmc_order_header
        WHERE order_num = ?
        LIMIT 1
      `,
      [normalizedOrderNumber]
    );

    if (!orderHeaderRows.length) {
      const error = new Error("Order not found");
      error.statusCode = 404;
      throw error;
    }

    const notificationUserId =
      Number(authUser?.userId) ||
      Number(authUser?.user_id) ||
      Number(orderHeaderRows[0]?.user_id) ||
      null;

    if (!notificationUserId) {
      const error = new Error("Unable to resolve the user for this order");
      error.statusCode = 400;
      throw error;
    }

    const createdBy = authUser?.username || authUser?.user_name || "SYSTEM";
    const requestedKitchenType = payload?.kitchenType
      ? normalizeKitchenType(payload.kitchenType)
      : null;

    const [detailRows] = await connection.execute(
      `
        SELECT
          od.item_id,
          od.quantity,
          od.price,
          od.subtotal,
          od.barcode,
          od.type_id,
          xi.item_name,
          xi.description,
          xi.category_id,
          xi.sub_category,
          c.category_name,
          CASE
            WHEN xi.category_id = 10 THEN (
              SELECT IFNULL(SUM(stock_quantity), 0)
              FROM xxafmc_stock_out so
              WHERE so.item_code = xi.item_code
            )
            ELSE COALESCE(
              NULLIF(xi.stock_quantity, 0),
              (
                SELECT IFNULL(SUM(stock_quantity), 0)
                FROM xxafmc_stock_out so
                WHERE so.item_code = xi.item_code
              ),
              0
            )
          END AS stock_quantity
        FROM xxafmc_order_details od
        JOIN xxafmc_inventory xi
          ON od.item_id = xi.item_code
        LEFT JOIN xxafmc_categories c
          ON xi.category_id = c.category_id
        WHERE od.order_id = ?
        ORDER BY od.order_line_id ASC
      `,
      [normalizedOrderNumber]
    );

      // If the frontend provided updated item quantities, persist them before proceeding.
      // Expected payload format: { items: [{ item_id: <id>, quantity: <qty> }, ...] }
      try {
        const payloadItems = Array.isArray(payload?.items) ? payload.items : [];
        if (payloadItems.length > 0) {
          for (const p of payloadItems) {
            const iid = Number(p?.item_id ?? p?.itemId ?? p?.ITEM_ID);
            const orderLineId = Number(p?.order_line_id ?? p?.orderLineId ?? p?.ORDER_LINE_ID);
            const isFreePayloadItem = Boolean(p?.is_free_item ?? p?.isFreeItem);
            const qty = Number(p?.quantity ?? p?.QUANTITY ?? p?.qty ?? 0);
            if (!Number.isFinite(iid) || iid <= 0) continue;
            if (!Number.isFinite(qty) || qty < 0) continue;
            if (isFreePayloadItem) continue;
            if (Number.isFinite(orderLineId) && orderLineId > 0) {
              await connection.execute(
                `UPDATE xxafmc_order_details SET quantity = ? WHERE order_id = ? AND order_line_id = ?`,
                [qty, normalizedOrderNumber, orderLineId]
              );
            } else {
              await connection.execute(
                `
                  UPDATE xxafmc_order_details
                  SET quantity = ?
                  WHERE order_id = ?
                    AND item_id = ?
                    AND NOT (IFNULL(price, 0) = 0 AND IFNULL(subtotal, 0) = 0)
                `,
                [qty, normalizedOrderNumber, iid]
              );
            }
          }

          // Refresh detailRows to reflect updated quantities
          const [refreshedRows] = await connection.execute(
            `
            SELECT
              od.item_id,
              od.quantity,
              od.price,
              od.subtotal,
              od.barcode,
              od.type_id,
              xi.item_name,
              xi.description,
              xi.category_id,
              xi.sub_category,
              c.category_name,
              CASE
                WHEN xi.category_id = 10 THEN (
                  SELECT IFNULL(SUM(stock_quantity), 0)
                  FROM xxafmc_stock_out so
                  WHERE so.item_code = xi.item_code
                )
                ELSE COALESCE(
                  NULLIF(xi.stock_quantity, 0),
                  (
                    SELECT IFNULL(SUM(stock_quantity), 0)
                    FROM xxafmc_stock_out so
                    WHERE so.item_code = xi.item_code
                  ),
                  0
                )
              END AS stock_quantity
            FROM xxafmc_order_details od
            JOIN xxafmc_inventory xi
              ON od.item_id = xi.item_code
            LEFT JOIN xxafmc_categories c
              ON xi.category_id = c.category_id
            WHERE od.order_id = ?
            ORDER BY od.order_line_id ASC
          `,
            [normalizedOrderNumber]
          );

          detailRows.splice(0, detailRows.length, ...refreshedRows);
        }
      } catch (qtyErr) {
        // Non-fatal: if applying quantities fails, rollback will happen later if needed.
        console.error("Failed to apply frontend item quantities:", qtyErr);
      }

    if (!detailRows.length) {
      const error = new Error("No order items found");
      error.statusCode = 404;
      throw error;
    }

    const zeroQtyRows = detailRows.filter((row) => Number(row.quantity || 0) === 0);
    if (zeroQtyRows.length > 0) {
      // Defensive cleanup: older/merged flows occasionally leave behind zero-quantity lines.
      // MySQL2 treats these as valid rows, but they should never block confirmation.
      await connection.execute(
        `DELETE FROM xxafmc_order_details WHERE order_id = ? AND (quantity = 0 OR quantity IS NULL)`,
        [normalizedOrderNumber]
      );

      // Refresh details after cleanup.
      const [refreshedRows] = await connection.execute(
        `
          SELECT
            od.item_id,
            od.quantity,
            od.price,
            od.subtotal,
            od.barcode,
            od.type_id,
            xi.item_name,
            xi.description,
            xi.category_id,
            xi.sub_category,
            c.category_name,
            CASE
              WHEN xi.category_id = 10 THEN (
                SELECT IFNULL(SUM(stock_quantity), 0)
                FROM xxafmc_stock_out so
                WHERE so.item_code = xi.item_code
              )
              ELSE COALESCE(
                NULLIF(xi.stock_quantity, 0),
                (
                  SELECT IFNULL(SUM(stock_quantity), 0)
                  FROM xxafmc_stock_out so
                  WHERE so.item_code = xi.item_code
                ),
                0
              )
            END AS stock_quantity
          FROM xxafmc_order_details od
          JOIN xxafmc_inventory xi
            ON od.item_id = xi.item_code
          LEFT JOIN xxafmc_categories c
            ON xi.category_id = c.category_id
          WHERE od.order_id = ?
          ORDER BY od.order_line_id ASC
        `,
        [normalizedOrderNumber]
      );

      detailRows.splice(0, detailRows.length, ...refreshedRows);

      if (!detailRows.length) {
        const error = new Error("No order items found");
        error.statusCode = 404;
        throw error;
      }
    }

    await syncOfferFreeItemsForOrder(connection, normalizedOrderNumber, createdBy);

    {
      const [refreshedRows] = await connection.execute(
        `
          SELECT
            od.item_id,
            od.quantity,
            od.price,
            od.subtotal,
            od.barcode,
            od.type_id,
            xi.item_name,
            xi.description,
            xi.category_id,
            xi.sub_category,
            c.category_name,
            CASE
              WHEN xi.category_id = 10 THEN (
                SELECT IFNULL(SUM(stock_quantity), 0)
                FROM xxafmc_stock_out so
                WHERE so.item_code = xi.item_code
              )
              ELSE COALESCE(
                NULLIF(xi.stock_quantity, 0),
                (
                  SELECT IFNULL(SUM(stock_quantity), 0)
                  FROM xxafmc_stock_out so
                  WHERE so.item_code = xi.item_code
                ),
                0
              )
            END AS stock_quantity
          FROM xxafmc_order_details od
          JOIN xxafmc_inventory xi
            ON od.item_id = xi.item_code
          LEFT JOIN xxafmc_categories c
            ON xi.category_id = c.category_id
          WHERE od.order_id = ?
          ORDER BY od.order_line_id ASC
        `,
        [normalizedOrderNumber]
      );

      detailRows.splice(0, detailRows.length, ...refreshedRows);

      if (!detailRows.length) {
        const error = new Error("No order items found");
        error.statusCode = 404;
        throw error;
      }
    }

    const itemCodes = [...new Set(detailRows.map((row) => Number(row.item_id)).filter((code) => Number.isFinite(code) && code > 0))];
    const cocktailItemIds = [...new Set(detailRows
      .filter((row) => [14, 15].includes(Number(row.sub_category)))
      .map((row) => Number(row.item_id))
      .filter((code) => Number.isFinite(code) && code > 0))];

    await applyCocktailCustomizations(connection, {
      orderNumber: normalizedOrderNumber,
      userId: notificationUserId,
      createdBy,
      detailRows,
      payload,
    });

    await syncCocktailCustomizationQuantities(connection, normalizedOrderNumber);

    const cocktailMaxMap = await getCocktailMaxQuantityMap(connection, normalizedOrderNumber, cocktailItemIds);

    if (itemCodes.length > 0) {
      // Lock inventory rows for all items in this order to ensure reserved/available checks
      // see a consistent view under concurrent confirmation attempts.
      for (const code of itemCodes) {
        // eslint-disable-next-line no-await-in-loop
        await lockReservationTotal(code);
      }

      const placeholders = itemCodes.map(() => "?").join(",");
      const [reservedRows] = await connection.execute(
        `
          SELECT item_code, IFNULL(reserved_qty, 0) AS reserved
          FROM xxafmc_stock_reservation_totals
          WHERE item_code IN (${placeholders})
        `,
        itemCodes
      );

      const reservedMap = reservedRows.reduce((map, row) => {
        map[String(row.item_code)] = Number(row.reserved || 0);
        return map;
      }, {});

      const outOfStockItem = detailRows.find((row) => {
        const isCocktailOrMocktail = [14, 15].includes(Number(row.sub_category));
        if (isCocktailOrMocktail) {
          const maxQty = cocktailMaxMap.get(Number(row.item_id));
          if (maxQty === null || maxQty === undefined) return false;
          return Number(row.quantity || 0) > Number(maxQty);
        }
        const stockQuantity = Number(row.stock_quantity || 0);
        const reservedQuantity = Number(reservedMap[String(row.item_id)] || 0);
        const availableQuantity = Math.max(0, stockQuantity - reservedQuantity);
        return Number(row.quantity || 0) > availableQuantity;
      });

      if (outOfStockItem) {
        const isCocktailOrMocktail = [14, 15].includes(Number(outOfStockItem.sub_category));
        const availableQuantity = isCocktailOrMocktail
          ? Number(cocktailMaxMap.get(Number(outOfStockItem.item_id)) ?? 0)
          : (() => {
              const stockQuantity = Number(outOfStockItem.stock_quantity || 0);
              const reservedQuantity = Number(reservedMap[String(outOfStockItem.item_id)] || 0);
              return Math.max(0, stockQuantity - reservedQuantity);
            })();
        const isFreeItem = Number(outOfStockItem.price || 0) === 0 && Number(outOfStockItem.subtotal || 0) === 0;
        const error = new Error(
          isFreeItem
            ? `Out of stock for free item. Available quantity: ${availableQuantity}`
            : `Out of stock for ${outOfStockItem.item_name || outOfStockItem.item_id}. Available quantity: ${availableQuantity}`
        );
        error.statusCode = 400;
        throw error;
      }

      // Reserve quantities now (confirmed orders only)
      for (const row of detailRows) {
        const itemId = Number(row.item_id || 0);
        const qty = Number(row.quantity || 0);
        if (!Number.isFinite(itemId) || itemId <= 0) continue;
        if (!Number.isFinite(qty) || qty <= 0) continue;

        const isCocktailOrMocktail = [14, 15].includes(Number(row.sub_category));
        if (!isCocktailOrMocktail) {
          // eslint-disable-next-line no-await-in-loop
          await reserveTotalsQty(itemId, qty);
          continue;
        }

        const [ingredientRows] = await connection.execute(
          `
            SELECT item_code, pegs
            FROM xxafmc_custom_cocktails_mocktails_details
            WHERE order_number = ?
              AND inventory_item_code = ?
          `,
          [normalizedOrderNumber, itemId]
        );

        for (const ingredient of ingredientRows) {
          const ingredientCode = Number(ingredient.item_code || 0);
          const pegsPerUnit = Number(ingredient.pegs || 0);
          const requiredQty = pegsPerUnit * qty;
          if (!Number.isFinite(requiredQty) || requiredQty <= 0) continue;
          // eslint-disable-next-line no-await-in-loop
          await lockReservationTotal(ingredientCode);
          // eslint-disable-next-line no-await-in-loop
          await reserveTotalsQty(ingredientCode, requiredQty);
        }
      }
    }

    // Add food preparation charges into subtotal at confirmation time (pricing parity with legacy flow).
    // IMPORTANT: Do NOT deduct `xxafmc_stock_out` here. Bar/Kitchen stock must be deducted only when
    // the item is actually scanned/processed; otherwise we "consume" a random FIFO barcode bucket
    // before any scan happens (and the UI will show that barcode as out of stock).
    //
    // If you ever need the old behavior, set `DEDUCT_STOCK_ON_CONFIRM=1` (not recommended for Bar).
    const shouldDeductOnConfirm = String(process.env.DEDUCT_STOCK_ON_CONFIRM || "").trim() === "1";

    for (const row of detailRows) {
      const itemId = Number(row.item_id || 0);
      const qty = Number(row.quantity || 0);
      if (!Number.isFinite(itemId) || itemId <= 0) continue;
      if (!Number.isFinite(qty) || qty <= 0) continue;

      if (shouldDeductOnConfirm) {
        const isCocktailOrMocktail = [14, 15].includes(Number(row.sub_category));

        if (!isCocktailOrMocktail) {
          await deductStockOutFifo(itemId, qty);
        } else {
          const [ingredientRows] = await connection.execute(
            `
              SELECT item_code, pegs
              FROM xxafmc_custom_cocktails_mocktails_details
              WHERE order_number = ?
                AND inventory_item_code = ?
            `,
            [normalizedOrderNumber, itemId]
          );

          for (const ingredient of ingredientRows) {
            const ingredientCode = Number(ingredient.item_code || 0);
            const pegsPerUnit = Number(ingredient.pegs || 0);
            const requiredQty = pegsPerUnit * qty;
            await deductStockOutFifo(ingredientCode, requiredQty);
          }
        }
      }

      await connection.execute(
        `
          UPDATE xxafmc_order_details
          SET subtotal = COALESCE(subtotal, 0) + COALESCE(food_pr_charges, 0)
          WHERE order_id = ?
            AND item_id = ?
        `,
        [normalizedOrderNumber, itemId]
      );
    }

    let insertedCount = 0;
    const insertedKitchenTypes = new Set();

    for (const item of detailRows) {
      const [existingRows] = await connection.execute(
        `
          SELECT COUNT(*) AS existingCount
          FROM xxafmc_kitchen_notification
          WHERE ordernumber = ?
            AND item_id = ?
            AND (barcode <=> ?)
            AND status IN ('Received', 'Preparing', 'Completed')
        `,
        [normalizedOrderNumber, item.item_id, item.barcode || null]
      );

      const existingCount = Number(existingRows[0]?.existingCount || 0);
      if (existingCount > 0) {
        continue;
      }

      const kitchenType =
        requestedKitchenType || deriveKitchenTypeFromCategory(item.category_name);

      await connection.execute(
        `
          INSERT INTO xxafmc_kitchen_notification
            (
              ordernumber,
              user_name,
              item_id,
              description,
              item_name,
              quantity,
              type_id,
              created_by,
              creation_date,
              msg_read,
              status,
              barcode,
              kitchen_type
            )
          VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'N', 'Received', ?, ?)
        `,
        [
          normalizedOrderNumber,
          notificationUserId,
          item.item_id,
          item.description || null,
          item.item_name,
          Number(item.quantity || 0),
          item.type_id || null,
          createdBy,
          item.barcode || null,
          kitchenType,
        ]
      );

      insertedCount += 1;
      if (kitchenType) {
        insertedKitchenTypes.add(kitchenType);
      }
    }

    // Cart flow: once an order is confirmed, clear the user's cart.
    await connection.execute(`DELETE FROM xxafmc_cart_items WHERE user_id = ?`, [
      notificationUserId,
    ]);

    await connection.commit();

    return {
      orderNumber: normalizedOrderNumber,
      insertedCount,
      kitchenTypes: [...insertedKitchenTypes],
      message:
        insertedCount > 0
          ? "Order confirmed successfully"
          : "Order was already confirmed",
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getConfirmedOrderDetails(orderNumber) {
  const normalizedOrderNumber = Number(orderNumber);
  if (!Number.isFinite(normalizedOrderNumber) || normalizedOrderNumber <= 0) {
    const error = new Error("Valid order number is required");
    error.statusCode = 400;
    throw error;
  }

  const [headerRows] = await db.execute(
    `
      SELECT
        oh.order_num,
        oh.order_date,
        ROUND(MAX(IFNULL(oh.order_total, 0)), 2) AS order_total,
        COALESCE(MAX(nm.first_name), MAX(u.first_name), '') AS customer_name,
        CASE
          WHEN COUNT(od.order_line_id) - SUM(CASE WHEN COALESCE(kn.status, '') = 'Cancelled' THEN 1 ELSE 0 END) > 0
            AND SUM(CASE WHEN COALESCE(kn.status, '') = 'Completed' THEN 1 ELSE 0 END) =
                COUNT(od.order_line_id) - SUM(CASE WHEN COALESCE(kn.status, '') = 'Cancelled' THEN 1 ELSE 0 END)
            THEN 'Completed'
          WHEN SUM(CASE WHEN COALESCE(kn.status, '') = 'Preparing' THEN 1 ELSE 0 END) > 0
            THEN 'Preparing'
          WHEN SUM(CASE WHEN COALESCE(kn.status, '') = 'Cancelled' THEN 1 ELSE 0 END) = COUNT(od.order_line_id)
            THEN 'Cancelled'
          ELSE 'Received'
        END AS status,
        COALESCE(MAX(inv.payment_status), 'Not Paid') AS payment_status
      FROM xxafmc_order_header oh
      JOIN xxafmc_order_details od
        ON od.order_id = oh.order_num
      LEFT JOIN xxafmc_users u
        ON u.user_id = oh.user_id
      LEFT JOIN xxafmc_non_members nm
        ON nm.id = oh.member_id
      LEFT JOIN xxafmc_kitchen_notification kn
        ON kn.ordernumber = od.order_id
        AND kn.item_id = od.item_id
        AND (kn.barcode <=> od.barcode)
      LEFT JOIN xxafmc_invoices inv
        ON inv.order_num = oh.order_num
      WHERE oh.order_num = ?
      GROUP BY oh.order_num, oh.order_date
      LIMIT 1
    `,
    [normalizedOrderNumber]
  );

  if (!headerRows.length) {
    const error = new Error("Order not found");
    error.statusCode = 404;
    throw error;
  }

  const [itemRows] = await db.execute(
    `
      SELECT
        od.item_id,
        xi.item_name,
        od.quantity,
        od.barcode,
        ROUND(MAX(IFNULL(od.subtotal, 0)), 2) AS subtotal,
        CASE
          WHEN COUNT(od.order_line_id) - SUM(CASE WHEN COALESCE(kn.status, '') = 'Cancelled' THEN 1 ELSE 0 END) > 0
            AND SUM(CASE WHEN COALESCE(kn.status, '') = 'Completed' THEN 1 ELSE 0 END) =
                COUNT(od.order_line_id) - SUM(CASE WHEN COALESCE(kn.status, '') = 'Cancelled' THEN 1 ELSE 0 END)
            THEN 'Completed'
          WHEN SUM(CASE WHEN COALESCE(kn.status, '') = 'Preparing' THEN 1 ELSE 0 END) > 0
            THEN 'Preparing'
          WHEN SUM(CASE WHEN COALESCE(kn.status, '') = 'Cancelled' THEN 1 ELSE 0 END) = COUNT(od.order_line_id)
            THEN 'Cancelled'
          ELSE 'Received'
        END AS status
      FROM xxafmc_order_details od
      JOIN xxafmc_inventory xi
        ON od.item_id = xi.item_code
      LEFT JOIN xxafmc_kitchen_notification kn
        ON kn.ordernumber = od.order_id
        AND kn.item_id = od.item_id
        AND (kn.barcode <=> od.barcode)
      WHERE od.order_id = ?
      GROUP BY od.order_line_id, od.item_id, xi.item_name, od.quantity, od.barcode
      ORDER BY od.order_line_id ASC
    `,
    [normalizedOrderNumber]
  );

  // APEX-style overall status calculation.
  const totalItems = itemRows.length;
  const statusCounts = itemRows.reduce(
    (acc, row) => {
      const s = String(row.status || "Received").trim();
      if (s === "Completed") acc.completed += 1;
      else if (s === "Preparing") acc.preparing += 1;
      else if (s === "Cancelled") acc.cancelled += 1;
      else acc.received += 1;
      return acc;
    },
    { completed: 0, preparing: 0, cancelled: 0, received: 0 }
  );

  const activeItems = totalItems - statusCounts.cancelled;
  let overallStatus = "Received";
  if (activeItems > 0 && statusCounts.completed === activeItems) {
    overallStatus = "Completed";
  } else if (statusCounts.preparing > 0) {
    overallStatus = "Preparing";
  } else if (totalItems > 0 && statusCounts.cancelled === totalItems) {
    overallStatus = "Cancelled";
  }

  return {
    header: {
      ...headerRows[0],
      status: overallStatus,
    },
    items: itemRows,
  };
}

module.exports = {
  confirmOrder,
  getConfirmedOrderDetails,
};
