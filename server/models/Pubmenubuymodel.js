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
        xxod.ITEM_ID,
        CONCAT(
          'Name: ', XXINV.ITEM_NAME,
          ' Quantity: ', xxod.QUANTITY
        ) AS CARD_TEXT,
        xxod.SUBTOTAL,
        XXINV.IMAGE,
        LENGTH(XXINV.IMAGE) AS CARD_TITLE,
        XXINV.ITEM_CODE,
        '#' AS CARD_LINK,
        CASE
          WHEN xxod.PRICE = 0 THEN NULL
          ELSE NULL
        END AS CARD_SUBTEXT
      FROM xxafmc_order_details xxod
      JOIN xxafmc_inventory XXINV
        ON xxod.item_id = XXINV.item_code
      WHERE xxod.order_id = ?
    `,
    [normalizedOrderNumber]
  );

  return {
    header: {
      ...headerRows[0],
      item_id: itemIdRows[0]?.item_id || null,
      order_total: Number(orderTotal.toFixed(2)),
      food_pr_charges: foodPrCharges,
    },
    items: itemRows,
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
          AND DATE(offer_date) = CURDATE()
          AND UPPER(status) = UPPER('Active')
        ORDER BY offer_id DESC
        LIMIT 1
      `,
      [itemCode, quantity]
    );

    if (offerRows.length > 0) {
      const offer = offerRows[0];
      const offerQuantity = Number(offer.offer_quantity || 0);
      const freeItemQuantity = Number(offer.free_item_quantity || 0);

      if (offerQuantity > 0 && offerQuantity === quantity && freeItemQuantity > 0) {
        const computedFreeQty = Math.floor((quantity / offerQuantity) * freeItemQuantity);

        if (computedFreeQty > 0) {
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

module.exports = {
  createOrder,
  getOrderSummary,
  cancelOrder,
};
