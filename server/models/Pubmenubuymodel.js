const db = require("../config/db");

async function getNextOrderLineId(connection) {
  const [[row]] = await connection.execute(
    `
      SELECT COALESCE(MAX(order_line_id), 0) + 1 AS nextId
      FROM xxafmc_order_details
    `
  );

  return Number(row?.nextId || 1);
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
        CONCAT(
          'Name: ', XXINV.ITEM_NAME,
          ' Quantity: ', xxod.QUANTITY
        ) AS card_text,
        xxod.SUBTOTAL AS subtotal,
        XXINV.IMAGE AS image,
        LENGTH(XXINV.IMAGE) AS card_title,
        XXINV.ITEM_CODE AS item_code,
        COALESCE(
          NULLIF(XXINV.STOCK_QUANTITY, 0),
          (
            SELECT IFNULL(SUM(stock_quantity), 0)
            FROM xxafmc_stock_out so
            WHERE so.item_code = XXINV.ITEM_CODE
          ),
          0
        ) AS stock_quantity,
        '#' AS card_link,
        CASE
          WHEN xxod.PRICE = 0 THEN NULL
          ELSE NULL
        END AS card_subtext
      FROM xxafmc_order_details xxod
      JOIN xxafmc_inventory XXINV
        ON xxod.item_id = XXINV.item_code
      WHERE xxod.order_id = ?
    `,
    [normalizedOrderNumber]
  );

  const itemCodes = itemRows
    .map((row) => Number(row.item_code))
    .filter((code) => Number.isFinite(code) && code > 0);
  const reservedMap = await getReservedQuantitiesExcludingOrder(db, itemCodes, normalizedOrderNumber);

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
    const stockQuantity = Number(row.stock_quantity || 0);
    const reservedQuantity = Number(reservedMap.get(String(row.item_code)) || 0);
    const availableQuantity = Math.max(0, stockQuantity - reservedQuantity);
    const offer = offerMap.get(Number(row.item_code));
    return {
      ...row,
      RESERVED_QUANTITY: reservedQuantity,
      AVAILABLE_QUANTITY: availableQuantity,
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

async function createOrder(payload = {}, authUser = {}) {
  const itemCode = Number(payload.itemCode);
  const quantity = Number(payload.quantity || 1);
  const categoryId = Number(payload.categoryId);
  const remarks = String(payload.remarks || "Din").trim() || "Din";
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

  if (!Number.isFinite(quantity) || quantity <= 0) {
    const error = new Error("Valid quantity is required");
    error.statusCode = 400;
    throw error;
  }

  const appUser = authUser?.username || authUser?.user_name || "SYSTEM";
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [userRows] = await connection.execute(
      `
        SELECT user_id
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

    const [inventoryRows] = await connection.execute(
      `
        SELECT
          ITEM_ID AS item_id,
          ITEM_CODE AS item_code,
          ITEM_NAME AS item_name,
          CATEGORY_ID AS category_id,
          SUB_CATEGORY AS sub_category,
          IFNULL(PROFIT, 0) AS profit,
          IFNULL(FOOD_PR_CHARGES, 0) AS food_pr_charges,
          IFNULL(\`A/C_UNIT\`, 'Nos') AS ac_unit
        FROM xxafmc_inventory
        WHERE ITEM_CODE = ?
        LIMIT 1
      `,
      [itemCode]
    );

    if (!inventoryRows.length) {
      const error = new Error("Inventory item not found");
      error.statusCode = 404;
      throw error;
    }

    const inventoryItem = inventoryRows[0];
    const resolvedCategoryId = Number.isFinite(categoryId) ? categoryId : Number(inventoryItem.category_id);
    const subCategory = inventoryItem.sub_category ?? null;
    const profit = Number(inventoryItem.profit || 0);
    const foodPrCharges = Number(inventoryItem.food_pr_charges || 0);

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
        [
          orderLineId,
          orderNumber,
          itemCode,
          typeId,
          quantity,
          remarks,
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
              total_quantity,
              created_by,
              creation_date,
              subcategory,
              profit,
              food_pr_charges
            )
          VALUES
            (?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?)
        `,
        [orderLineId, orderNumber, itemCode, quantity, quantity, appUser, subCategory, profit, foodPrCharges]
      );
    }

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
      [itemCode, quantity]
    );

    if (offerRows.length > 0) {
      const offer = offerRows[0];
      const offerQuantity = Number(offer.offer_quantity || 0);
      const freeItemQuantity = Number(offer.free_item_quantity || 0);

      if (offerQuantity > 0 && freeItemQuantity > 0) {
        const computedFreeQty = Math.floor(quantity / offerQuantity) * freeItemQuantity;

        if (computedFreeQty > 0) {
          const freeItemCode = Number(offer.free_item_code || 0);
          if (Number.isFinite(freeItemCode) && freeItemCode > 0) {
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
              orderNumber
            );
            const freeReservedQuantity = Number(freeReservedMap.get(String(freeItemCode)) || 0);
            const freeAvailableQuantity = Math.max(0, freeStockQuantity - freeReservedQuantity);

            if (computedFreeQty > freeAvailableQuantity) {
              const error = new Error(`Out of stock for free item. Available quantity: ${freeAvailableQuantity}`);
              error.statusCode = 400;
              throw error;
            }
          }

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
              quantity,
              appUser,
              subCategory,
              offer.item_code,
            ]
          );
        }
      }
    }

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

    const stockQuantity = Number(invRow?.stock_quantity || 0);
    const reservedMap = await getReservedQuantitiesExcludingOrder(connection, [itemId], normalizedOrderNumber);
    const reservedQuantity = Number(reservedMap.get(String(itemId)) || 0);
    const availableQuantity = Math.max(0, stockQuantity - reservedQuantity);

    if (normalizedQuantity > availableQuantity) {
      const error = new Error(`Out of stock. Available quantity: ${availableQuantity}`);
      error.statusCode = 400;
      throw error;
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
  updateOrderLineQuantity,
};
