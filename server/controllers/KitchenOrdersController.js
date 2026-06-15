const pool = require("../config/db");
const { getStartOfDay, getEndOfDay } = require("../utils/dateUtils");

const getRequestUsername = (req) =>
  String(req.user?.username || req.user?.user_name || req.body?.appUser || "").trim();

const getSessionUserKey = (req) => getRequestUsername(req) || "unknown";

const getScanSessionKey = (req, orderNumber) =>
  `scannedItems_${orderNumber}_${getSessionUserKey(req)}`;

const normalizeKitchen = (value) => {
  const kitchen = String(value || "Bar").trim().toLowerCase();
  return kitchen === "kitchen" ? "Kitchen" : "Bar";
};

const getKitchenConfig = (value) => {
  const kitchen = normalizeKitchen(value);
  const isBar = kitchen === "Bar";

  return {
    kitchen,
    categoryId: isBar ? 10 : 14,
    handledByField: isBar ? "handled_by_bar" : "handled_by_kitchen",
  };
};

const sameCode = (left, right) => String(left ?? "").trim() === String(right ?? "").trim();

const saveSession = (req) =>
  new Promise((resolve, reject) => {
    if (!req.session?.save) return resolve();
    req.session.save((err) => (err ? reject(err) : resolve()));
  });

async function releaseReservationRows(connection, reservationRows) {
  console.log("Releasing reservation rows:", reservationRows);
  
  for (const row of reservationRows) {
    const itemCode = String(row.item_code || "").trim();
    const quantity = Number(row.release_qty || 0);
    if (!itemCode || !Number.isFinite(quantity) || quantity <= 0) {
      console.log("Skipping invalid row:", { itemCode, quantity });
      continue;
    }

    console.log(`Releasing ${quantity} units for item code ${itemCode}`);

    await connection.query(
      `INSERT IGNORE INTO xxafmc_stock_reservation_totals (item_code, reserved_qty) VALUES (?, 0)`,
      [itemCode]
    );
    
    const [result] = await connection.query(
      `
        UPDATE xxafmc_stock_reservation_totals
        SET reserved_qty = GREATEST(0, IFNULL(reserved_qty, 0) - ?)
        WHERE item_code = ?
        LIMIT 1
      `,
      [quantity, itemCode]
    );
    
    console.log(`Released ${quantity} for item ${itemCode}. Update result:`, result.affectedRows);
  }
}

async function getReservationReleaseRowsForCancel(connection, { orderNumber, orderLineId, categoryId }) {
  const params = [];
  let filterSql = "";

  if (orderLineId) {
    filterSql = "xod.ORDER_LINE_ID = ?";
    params.push(orderLineId);
  } else {
    filterSql = "xod.ORDER_ID = ? AND inv.category_id = ?";
    params.push(orderNumber, categoryId);
  }

  const [rows] = await connection.query(
    `
      SELECT item_code, SUM(release_qty) AS release_qty
      FROM (
        SELECT
          xod.item_id AS item_code,
          SUM(COALESCE(xod.quantity, 0)) AS release_qty
        FROM xxafmc_order_details xod
        JOIN (${inventorySummarySql}) inv ON inv.item_code = xod.item_id
        WHERE ${filterSql}
          AND (xod.ORDER_STATUS IS NULL OR TRIM(xod.ORDER_STATUS) = '')
          AND COALESCE(inv.sub_category, xod.subcategory) NOT IN (14, 15)
        GROUP BY xod.item_id

        UNION ALL

        SELECT
          cm.item_code,
          SUM(COALESCE(cm.pegs, 0) * COALESCE(cm.quantity, 0)) AS release_qty
        FROM xxafmc_order_details xod
        JOIN (${inventorySummarySql}) inv ON inv.item_code = xod.item_id
        JOIN xxafmc_custom_cocktails_mocktails_details cm
          ON cm.order_number = xod.order_id
         AND cm.inventory_item_code = xod.item_id
        WHERE ${filterSql}
          AND (xod.ORDER_STATUS IS NULL OR TRIM(xod.ORDER_STATUS) = '')
          AND COALESCE(inv.sub_category, xod.subcategory) IN (14, 15)
        GROUP BY cm.item_code

        UNION ALL

        SELECT
          cm.item_code,
          SUM(COALESCE(cm.pegs, 0) * COALESCE(cm.quantity, 0)) AS release_qty
        FROM xxafmc_order_details xod
        JOIN (${inventorySummarySql}) inv ON inv.item_code = xod.item_id
        JOIN xxafmc_custom_cocktails_mocktails_details_dummy cm
          ON cm.order_number = xod.order_id
         AND cm.inventory_item_code = xod.item_id
        WHERE ${filterSql}
          AND (xod.ORDER_STATUS IS NULL OR TRIM(xod.ORDER_STATUS) = '')
          AND COALESCE(inv.sub_category, xod.subcategory) IN (14, 15)
        GROUP BY cm.item_code

        UNION ALL

        SELECT
          recipe.item_code,
          SUM(COALESCE(recipe.pegs, 0) * COALESCE(xod.quantity, 0)) AS release_qty
        FROM xxafmc_order_details xod
        JOIN (${inventorySummarySql}) inv ON inv.item_code = xod.item_id
        JOIN xxafmc_cocktails_mocktails_details recipe
          ON recipe.inventory_item_code = xod.item_id
        WHERE ${filterSql}
          AND (xod.ORDER_STATUS IS NULL OR TRIM(xod.ORDER_STATUS) = '')
          AND COALESCE(inv.sub_category, xod.subcategory) IN (14, 15)
          AND NOT EXISTS (
            SELECT 1
            FROM xxafmc_custom_cocktails_mocktails_details custom
            WHERE custom.order_number = xod.order_id
              AND custom.inventory_item_code = xod.item_id
          )
          AND NOT EXISTS (
            SELECT 1
            FROM xxafmc_custom_cocktails_mocktails_details_dummy custom
            WHERE custom.order_number = xod.order_id
              AND custom.inventory_item_code = xod.item_id
          )
        GROUP BY recipe.item_code
      ) release_rows
      GROUP BY item_code
    `,
    [...params, ...params, ...params, ...params]
  );

  return rows;
}

const inventorySummarySql = `
  SELECT
    item_code,
    MAX(item_name) AS item_name,
    MAX(category_id) AS category_id,
    MAX(sub_category) AS sub_category,
    MAX(profit) AS profit,
    MAX(non_member_profit) AS non_member_profit,
    MAX(pr_charges) AS pr_charges,
    MAX(food_pr_charges) AS food_pr_charges
  FROM xxafmc_inventory
  GROUP BY item_code
`;

async function validateScansBeforeComplete(connection, req, orderNumber, kitchen) {
  const { categoryId } = getKitchenConfig(kitchen);
  const sessionKey = getScanSessionKey(req, orderNumber);
  const scannedItems = req.session[sessionKey] || [];

  const scannedQty = (predicate, { includeFree = false } = {}) =>
    scannedItems
      .filter((item) => includeFree || !item.isFreeItem)
      .filter(predicate)
      .reduce((sum, item) => sum + Number(item.scanQuantity || 0), 0);

  const [orderRows] = await connection.query(
    `
    SELECT
      xod.item_id,
      SUM(COALESCE(xod.quantity, 0)) AS quantity,
      MAX(xod.subcategory) AS subcategory,
      xod.type,
      MAX(inv.item_name) AS item_name
    FROM xxafmc_order_details xod
    JOIN (${inventorySummarySql}) inv
      ON inv.item_code = xod.item_id
    WHERE xod.order_id = ?
      AND xod.barcode IS NULL
      AND (xod.order_status IS NULL OR xod.order_status = '')
      AND inv.category_id = ?
    GROUP BY xod.item_id, xod.type
    `,
    [orderNumber, categoryId]
  );

  const errors = [];

  for (const row of orderRows) {
    const parentItem = String(row.item_id || "").trim();
    const subcategory = Number(row.subcategory);
    const itemName = row.item_name || parentItem;

    if (![14, 15].includes(subcategory)) {
      const pegMultiplier = String(row.type || "").trim().toUpperCase() === "LARGE" ? 2 : 1;
      const expected = Number(row.quantity || 0) * pegMultiplier;
      const scanned = scannedQty(
        (item) =>
          sameCode(item.itemCode, parentItem) &&
          sameCode(item.parentItem || item.itemCode, parentItem)
      );

      if (scanned !== expected) {
        errors.push(
          `Mismatch for item ${itemName}: ordered ${row.quantity} ${row.type || ""}, expected scans ${expected}, scanned ${scanned}.`
        );
      }
      continue;
    }

    const [[expectedRow]] = await connection.query(
      `
      SELECT COALESCE(SUM(pegs * quantity), 0) AS expected_pegs
      FROM (
        SELECT pegs, quantity
        FROM xxafmc_custom_cocktails_mocktails_details
        WHERE order_number = ?
          AND inventory_item_code = ?
        UNION ALL
        SELECT pegs, quantity
        FROM xxafmc_custom_cocktails_mocktails_details_dummy
        WHERE order_number = ?
          AND inventory_item_code = ?
        UNION ALL
        SELECT xcmd.pegs, SUM(xod.quantity) AS quantity
        FROM xxafmc_cocktails_mocktails_details xcmd
        JOIN xxafmc_order_details xod
          ON xod.item_id = xcmd.inventory_item_code
         AND xod.order_id = ?
         AND (xod.order_status IS NULL OR xod.order_status = '')
        WHERE xcmd.inventory_item_code = ?
          AND NOT EXISTS (
            SELECT 1
            FROM xxafmc_custom_cocktails_mocktails_details x
            WHERE x.inventory_item_code = xcmd.inventory_item_code
              AND x.order_number = ?
          )
          AND NOT EXISTS (
            SELECT 1
            FROM xxafmc_custom_cocktails_mocktails_details_dummy x
            WHERE x.inventory_item_code = xcmd.inventory_item_code
              AND x.order_number = ?
          )
        GROUP BY xcmd.inventory_item_code, xcmd.item_code, xcmd.pegs
      ) x
      `,
      [orderNumber, parentItem, orderNumber, parentItem, orderNumber, parentItem, orderNumber, orderNumber]
    );

    const expected = Number(expectedRow?.expected_pegs || 0);
    const scanned = scannedQty((item) => sameCode(item.parentItem || item.itemCode, parentItem));

    if (scanned !== expected) {
      errors.push(
        `Mismatch for parent item ${itemName}: expected pegs ${expected}, scanned ${scanned}.`
      );
    }
  }

  const [pairRows] = await connection.query(
    `
    SELECT
      inventory_item_code AS parent_item,
      item_code AS child_item,
      SUM(pegs * quantity) AS expected_pegs
    FROM (
      SELECT inventory_item_code, item_code, pegs, quantity
      FROM xxafmc_custom_cocktails_mocktails_details
      WHERE order_number = ?
      UNION ALL
      SELECT inventory_item_code, item_code, pegs, quantity
      FROM xxafmc_custom_cocktails_mocktails_details_dummy
      WHERE order_number = ?
      UNION ALL
      SELECT xcmd.inventory_item_code, xcmd.item_code, xcmd.pegs, SUM(xod.quantity) AS quantity
      FROM xxafmc_cocktails_mocktails_details xcmd
      JOIN xxafmc_order_details xod
        ON xod.item_id = xcmd.inventory_item_code
       AND xod.order_id = ?
       AND (xod.order_status IS NULL OR xod.order_status = '')
      WHERE NOT EXISTS (
          SELECT 1
          FROM xxafmc_custom_cocktails_mocktails_details x
          WHERE x.inventory_item_code = xcmd.inventory_item_code
            AND x.order_number = ?
        )
        AND NOT EXISTS (
          SELECT 1
          FROM xxafmc_custom_cocktails_mocktails_details_dummy x
          WHERE x.inventory_item_code = xcmd.inventory_item_code
            AND x.order_number = ?
        )
      GROUP BY xcmd.inventory_item_code, xcmd.item_code, xcmd.pegs
    ) x
    GROUP BY inventory_item_code, item_code
    `,
    [orderNumber, orderNumber, orderNumber, orderNumber, orderNumber]
  );

  for (const pair of pairRows) {
    const expected = Number(pair.expected_pegs || 0);
    const scanned = scannedQty(
      (item) => sameCode(item.itemCode, pair.child_item) && sameCode(item.parentItem, pair.parent_item)
    );

    if (scanned !== expected && scannedQty((item) => sameCode(item.parentItem, pair.parent_item)) > 0) {
      errors.push(
        `Child item ${pair.child_item} mismatch for parent ${pair.parent_item}: expected pegs ${expected}, scanned ${scanned}.`
      );
    }
  }

  if (errors.length > 0) {
    const error = new Error(errors.join(" "));
    error.statusCode = 400;
    throw error;
  }
}

exports.getOrders = async (req, res) => {
  try {
    const appUser = getRequestUsername(req);
    const { categoryId, handledByField } = getKitchenConfig(req.query.kitchen);

    const query = `
      SELECT * FROM (
        SELECT
          a.ordernumber AS ORDERNUMBER,

          MAX(
            COALESCE(
              (SELECT NULLIF(TRIM(xnm.FIRST_NAME), '') FROM xxafmc_non_members xnm WHERE xnm.ID = oh.member_id),
              (SELECT NULLIF(TRIM(xu2.FIRST_NAME), '') FROM xxafmc_users xu2 WHERE xu2.user_id = oh.user_id),
              CONCAT('Order ', a.ordernumber)
            )
          ) AS FIRST_NAME,

          CASE
            WHEN SUM(CASE WHEN a.STATUS = 'Received' THEN 1 ELSE 0 END) > 0 THEN 'Received'
            WHEN SUM(CASE WHEN a.STATUS = 'Preparing' THEN 1 ELSE 0 END) > 0 THEN 'Preparing'
            WHEN SUM(CASE WHEN a.STATUS = 'Completed' THEN 1 ELSE 0 END) > 0 THEN 'Completed'
            ELSE MAX(a.STATUS)
          END AS STATUS,

          CASE
            WHEN SUM(CASE WHEN a.STATUS = 'Received' THEN 1 ELSE 0 END) > 0 THEN 'Received'
            WHEN SUM(CASE WHEN a.STATUS = 'Preparing' THEN 1 ELSE 0 END) > 0 THEN 'Preparing'
            WHEN SUM(CASE WHEN a.STATUS = 'Completed' THEN 1 ELSE 0 END) > 0 THEN 'Completed'
            ELSE MAX(a.STATUS)
          END AS Status1,

          CASE
            WHEN SUM(CASE WHEN a.STATUS = 'Received' THEN 1 ELSE 0 END) > 0 THEN '1-yellow'
            WHEN SUM(CASE WHEN a.STATUS = 'Preparing' THEN 1 ELSE 0 END) > 0 THEN '2-red'
            WHEN SUM(CASE WHEN a.STATUS = 'Completed' THEN 1 ELSE 0 END) > 0 THEN '3-green'
            ELSE '4-grey'
          END AS COLOR,

          CASE
            WHEN SUM(CASE WHEN a.STATUS = 'Received' THEN 1 ELSE 0 END) > 0 THEN 1
            WHEN SUM(CASE WHEN a.STATUS = 'Preparing' THEN 1 ELSE 0 END) > 0 THEN 2
            WHEN SUM(CASE WHEN a.STATUS = 'Completed' THEN 1 ELSE 0 END) > 0 THEN 3
            ELSE 4
          END AS seq,

          MAX(a.NOTIFICATION_ID) AS NOTIFICATION_ID,
          MAX(a.CREATION_DATE) AS CREATION_DATE,

          MAX(
            CASE
              WHEN inv.SUB_CATEGORY IN (14, 15) THEN 'Y'
              ELSE 'N'
            END
          ) AS LINK_ENABLED,

          MAX(a.handled_by_bar) AS Handled_by_bar,
          MAX(a.handled_by_kitchen) AS Handled_by_kitchen,

         CASE
  WHEN SUM(CASE WHEN a.STATUS = 'Received' THEN 1 ELSE 0 END) > 0 THEN 'Y'
  ELSE 'N'
END AS CAN_CANCEL,

          CASE
            WHEN SUM(CASE WHEN a.STATUS IN ('Received','Preparing') THEN 1 ELSE 0 END) > 0 THEN 'Y'
            ELSE 'N'
          END AS CAN_NAVIGATE

        FROM xxafmc_kitchen_notification a
        JOIN (${inventorySummarySql}) inv ON a.item_id = inv.item_code
        LEFT JOIN xxafmc_order_header oh ON a.ordernumber = oh.order_num

        WHERE inv.category_id = ?
          AND (
            a.STATUS IN ('Received','Completed')
            OR (
              a.STATUS = 'Preparing'
              AND (
                TRIM(IFNULL(a.${handledByField}, '')) = ''
                OR a.${handledByField} = (
                  SELECT xu3.FIRST_NAME
                  FROM xxafmc_users xu3
                  WHERE LOWER(xu3.user_name) = LOWER(?)
                  LIMIT 1
                )
              )
            )
          )

        GROUP BY a.ordernumber

      ) tbl
      ORDER BY seq ASC, ORDERNUMBER DESC
    `;

    const [rows] = await pool.query(query, [categoryId, appUser]);
    // console.log(rows);
    res.status(200).json(rows);

  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({
      message: "Failed to fetch orders",
      error: error.message,
    });
  }
};

exports.updateBarOrderStatus = async (req, res) => {
  let connection;
  try {
    const { ORDERNUMBER, KITCHEN = "Bar", STATUS = "Preparing" } = req.body;

    const appUser = getRequestUsername(req);

    if (!ORDERNUMBER) {
      return res.status(400).json({
        success: false,
        message: "Order number is required",
      });
    }

    const [userRows] = await pool.query(
      `SELECT first_name FROM xxafmc_users WHERE LOWER(user_name) = LOWER(?) LIMIT 1`,
      [appUser]
    );

    if (userRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Logged in user not found",
      });
    }

    const handledBy = userRows[0].first_name;
    const { categoryId, handledByField } = getKitchenConfig(KITCHEN);
    const normalizedStatus = String(STATUS || "Preparing").trim();

    let result;

    if (normalizedStatus === "Completed") {
      // First, get scanned items from session and insert into database
      const sessionKey = getScanSessionKey(req, ORDERNUMBER);
      const scannedItems = req.session[sessionKey] || [];

      connection = await pool.getConnection();
      await connection.beginTransaction();

      await validateScansBeforeComplete(connection, req, ORDERNUMBER, KITCHEN);

      // Insert scanned items + update status atomically to avoid partial/dirty state.
      if (scannedItems.length > 0) {
        const placeholders = scannedItems.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
        const values = [];
        const orderPriceMap = new Map();

        for (const item of scannedItems) {
          const targetItemCode = String(item.parentItem || item.itemCode || "").trim();
          const numericItemPrice = Number(item.itemPrice || 0);

          if (targetItemCode) {
            const existing = orderPriceMap.get(targetItemCode);
            if (!existing || numericItemPrice > 0 || existing === 0) {
              orderPriceMap.set(targetItemCode, numericItemPrice);
            }
          }

          values.push(
            "S_COLLECTION",
            ORDERNUMBER,
            item.itemCode,
            item.itemName,
            item.scanQuantity,
            item.itemPrice,
            item.barcode,
            item.parentItem || item.itemCode,
            JSON.stringify({
              categoryId: item.categoryId,
              subCategory: item.subCategory,
              isFreeItem: item.isFreeItem,
              isCocktailIngredient: item.isCocktailIngredient,
              ingredients: item.ingredients,
              pegs: item.pegs,
              roleId: item.roleId,
              acUnit: item.acUnit,
              scannedAt: item.scannedAt,
            })
          );
        }

        await connection.query(
          `
          INSERT INTO order_scan_collection
            (collection_name, order_number, item_code, item_name, scan_quantity, item_price, barcode, inventory_item_code, extra_data)
          VALUES ${placeholders}
          `,
          values
        );

        // Update stock in xxafmc_stock_out and xxafmc_inventory
        for (const item of scannedItems) {
          const qty = Number(item.scanQuantity || 0);
          const physicalItemCode = String(item.itemCode || "").trim();

          if (qty > 0) {
            // Decrement the specific barcode's stock
            await connection.query(
              `UPDATE xxafmc_stock_out SET STOCK_QUANTITY = GREATEST(0, STOCK_QUANTITY - ?) WHERE BARCODE = ?`,
              [qty, item.barcode]
            );

             

              // Decrement reserved totals for this item (does not touch stock_out buckets)
              if (physicalItemCode) {
                await connection.query(
                  `INSERT IGNORE INTO xxafmc_stock_reservation_totals (item_code, reserved_qty) VALUES (?, 0)`,
                  [physicalItemCode]
                );
                await connection.query(
                  `
                    UPDATE xxafmc_stock_reservation_totals
                    SET reserved_qty = GREATEST(0, IFNULL(reserved_qty, 0) - ?)
                    WHERE item_code = ?
                    LIMIT 1
                  `,
                  [qty, physicalItemCode]
                );
              }
            }
          }

        // Update prices specifically by order_line_id for standard items
        const linePrices = new Map();
        scannedItems.forEach(si => {
          if (si.orderLineId) {
            const current = linePrices.get(si.orderLineId) || 0;
            if (Number(si.itemPrice) > 0 || current === 0) {
              linePrices.set(si.orderLineId, Number(si.itemPrice));
            }
          }
        });

        for (const [lineId, price] of linePrices.entries()) {
          await connection.query(
            `UPDATE xxafmc_order_details SET price = ?, subtotal = ROUND(? * quantity, 2), ORDER_STATUS = 'COMPLETED' WHERE ORDER_LINE_ID = ?`,
            [price, price, lineId]
          );
        }
      }

      // Then update the order status
      [result] = await connection.query(
        `
        UPDATE xxafmc_kitchen_notification a
        SET a.status = 'Completed'
        WHERE a.ordernumber = ?
          AND a.status IN ('Received', 'Preparing')
          AND EXISTS (
            SELECT 1
            FROM (${inventorySummarySql}) inv
            WHERE inv.item_code = a.item_id
              AND inv.category_id = ?
          )
        `,
        [ORDERNUMBER, categoryId]
      );

      await connection.commit();

      // Clear the session only after commit succeeds.
      delete req.session[sessionKey];
      await saveSession(req);
    } else {
      [result] = await pool.query(
        `
        UPDATE xxafmc_kitchen_notification a
        SET
          a.status = 'Preparing',
          a.${handledByField} = ?
        WHERE a.ordernumber = ?
          AND a.status = 'Received'
          AND EXISTS (
            SELECT 1
            FROM (${inventorySummarySql}) inv
            WHERE inv.item_code = a.item_id
              AND inv.category_id = ?
          )
        `,
        [handledBy, ORDERNUMBER, categoryId]
      );
    }

    return res.status(200).json({
      success: true,
      message: result.affectedRows > 0
        ? `Order status updated to ${normalizedStatus}`
        : "No status update required",
    });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (_) { }
    }
    console.error("Error updating bar order status:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : "Failed to update order status",
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

exports.getOrderItems = async (req, res) => {
  try {
    const { ORDERNUMBER, KITCHEN } = req.body;

    if (!ORDERNUMBER) {
      return res.status(400).json({ success: false, message: "ORDERNUMBER is required" });
    }
    const { categoryId } = getKitchenConfig(KITCHEN);

    const query = `
  SELECT 
    MIN(xod.ORDER_LINE_ID) AS ORDER_LINE_ID,
    xod.ITEM_ID,
    SUM(xod.quantity) AS PARENT_QTY,
    SUM(CASE WHEN xod.price > 0 OR xod.price IS NULL THEN xod.quantity ELSE 0 END) AS PAID_QTY,
    SUM(CASE WHEN xod.price = 0 THEN xod.quantity ELSE 0 END) AS FREE_QTY,
     CASE
       WHEN MAX(xi.SUB_CATEGORY) IN (14, 15) THEN
         COALESCE( /* Cocktail/mocktail scans: sum ingredient pegs * ordered qty */
           (SELECT SUM(COALESCE(xccd.pegs, 1) * COALESCE(xccd.quantity, 0))
            FROM xxafmc_custom_cocktails_mocktails_details xccd
            WHERE xccd.order_number = xod.ORDER_ID
              AND xccd.inventory_item_code = xod.ITEM_ID),
           (SELECT SUM(COALESCE(xccdd.pegs, 1) * COALESCE(xccdd.quantity, 0))
            FROM xxafmc_custom_cocktails_mocktails_details_dummy xccdd
            WHERE xccdd.order_number = xod.ORDER_ID
              AND xccdd.inventory_item_code = xod.ITEM_ID),
           (SELECT SUM(
              COALESCE(xcmd.pegs, 1) * (
                SELECT SUM(xod_inner.quantity)
                FROM xxafmc_order_details xod_inner
                WHERE xod_inner.order_id = xod.ORDER_ID
                  AND xod_inner.item_id = xod.ITEM_ID
                  AND xod_inner.type = xod.TYPE
              )
            )
            FROM xxafmc_cocktails_mocktails_details xcmd
            WHERE xcmd.inventory_item_code = xod.ITEM_ID
            GROUP BY xcmd.inventory_item_code),
           0
         )
       ELSE
         SUM(
           CASE
             WHEN UPPER(TRIM(COALESCE(xod.type, ''))) = 'LARGE' THEN 2
             ELSE 1
           END * xod.quantity
         ) /* Regular items: Large needs 2 scans per ordered unit */
     END AS TOTAL_INGREDIENTS,
    MAX(xi.ITEM_NAME) AS ITEM_NAME,
    COALESCE(xod.TYPE, 'NA') AS TYPE,

    CASE 
      WHEN MAX(xi.SUB_CATEGORY) IN (14, 15) THEN 'Y'
      ELSE 'N'
    END AS LINK_ENABLED,

    'Y' AS CAN_CANCEL

  FROM xxafmc_order_details xod

  LEFT JOIN (${inventorySummarySql}) xi
    ON xod.ITEM_ID = xi.ITEM_CODE

  WHERE xod.ORDER_ID = ?
    AND (xod.ORDER_STATUS IS NULL OR xod.ORDER_STATUS = '')
    AND xi.CATEGORY_ID = ?

  GROUP BY xod.ITEM_ID, xod.TYPE
  ORDER BY ORDER_LINE_ID ASC;
`;

    const [rows] = await pool.query(query, [ORDERNUMBER, categoryId]);

    const formattedData = rows.map((row) => ({
      ORDER_LINE_ID: row.ORDER_LINE_ID,
      ITEM_ID: row.ITEM_ID,
      quantity: Number(row.PARENT_QTY) || 0,
      paidQty: Number(row.PAID_QTY) || 0,
      freeQty: Number(row.FREE_QTY) || 0,
      ingredientsPerUnit: Math.max(
        1,
        Math.round((Number(row.TOTAL_INGREDIENTS) || 0) / (Number(row.PARENT_QTY) || 1))
      ),
      ITEM_NAME: (row.ITEM_NAME || '').trim(),
      TYPE: row.TYPE,
      LINK_ENABLED: row.LINK_ENABLED,
      CAN_CANCEL: row.CAN_CANCEL,
    }));

    return res.status(200).json({
      success: true,
      count: formattedData.length,
      data: formattedData,
    });

  } catch (error) {
    console.error("Error fetching order items:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch order items",
      error: error.message,
    });
  }
};

exports.processBarcodeScan = async (req, res) => {
  let connection;
  let transactionCommitted = false;
  try {
    const { ORDERNUMBER, BARCODE, QUANTITY = 1, KITCHEN = "Bar", PARENT_ITEM } = req.body;

    if (!ORDERNUMBER || !BARCODE) {
      return res.status(400).json({ success: false, message: "Order number and barcode are required" });
    }

    const requestedQty = Number(QUANTITY) || 1;
    const { kitchen } = getKitchenConfig(KITCHEN);
    const sessionKey = getScanSessionKey(req, ORDERNUMBER);

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // STEP 1: Get item details
    const [itemRows] = await connection.query(`
       SELECT xso.ITEM_CODE, xso.STOCK_QUANTITY, xso.UNIT_PRICE, xso.\`A/C_UNIT\` AS ac_unit,
              xso.PEGS, xi.category_id AS CATEGORY_ID, xi.item_name AS ITEM_NAME,
              xi.sub_category AS SUB_CATEGORY, xi.profit AS PROFIT,
              xi.non_member_profit AS NON_MEMBER_PROFIT, xi.pr_charges AS PR_CHARGES,
              xi.food_pr_charges AS FOOD_PR_CHARGES
       FROM xxafmc_stock_out xso
       LEFT JOIN (${inventorySummarySql}) xi ON xso.ITEM_CODE = xi.item_code
       WHERE xso.BARCODE = ?
       ORDER BY IFNULL(xso.STOCK_QUANTITY, 0) DESC, xso.CREATION_DATE DESC
       LIMIT 1`, [BARCODE]);

    if (itemRows.length === 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: "Barcode not found in inventory" });
    }

    const item = itemRows[0];
    const scanItemCode = item.ITEM_CODE;
    const stockQuantity = Number(item.STOCK_QUANTITY) || 0;
    const acUnit = (item.ac_unit || "").toString().trim();

    // Kitchen validation
    const categoryId = Number(item.CATEGORY_ID) || 0;
    if (kitchen === "Bar" && categoryId === 14) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: "Scanned Barcode is for Kitchen" });
    }
    if (kitchen === "Kitchen" && categoryId === 10) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: "Scanned Barcode is for Bar" });
    }

    if (stockQuantity <= 0) {
      const [altRows] = await connection.query(
        `
          SELECT BARCODE AS barcode, STOCK_QUANTITY AS stock_quantity
          FROM xxafmc_stock_out
          WHERE ITEM_CODE = ?
            AND IFNULL(STOCK_QUANTITY, 0) > 0
          ORDER BY CREATION_DATE ASC
          LIMIT 5
        `,
        [scanItemCode]
      );
      const alternatives = (altRows || []).map((r) => String(r.barcode)).filter(Boolean);

      await connection.rollback();
      return res.status(400).json({
        success: false,
        message:
          `Scanned Barcode ${BARCODE} has no stock`
      });
    }

    // Get parent item (cocktail/mocktail item code)
    // If an ingredient belongs to multiple cocktails/mocktails in the same order,
    // we must know which parent item it should be attributed to.
    const forcedParentItem = String(PARENT_ITEM || "").trim();

    if (!forcedParentItem) {
      const [possibleParentRows] = await connection.query(
        `
        SELECT DISTINCT inventory_item_code FROM (
          SELECT inventory_item_code
          FROM xxafmc_custom_cocktails_mocktails_details
          WHERE order_number = ? AND item_code = ?
          UNION ALL
          SELECT inventory_item_code
          FROM xxafmc_custom_cocktails_mocktails_details_dummy
          WHERE order_number = ? AND item_code = ?
          UNION ALL
          SELECT inventory_item_code
          FROM xxafmc_cocktails_mocktails_details
          WHERE item_code = ?
            AND inventory_item_code IN (
              SELECT item_id FROM xxafmc_order_details WHERE order_id = ?
            )
        ) p
        `,
        [ORDERNUMBER, scanItemCode, ORDERNUMBER, scanItemCode, scanItemCode, ORDERNUMBER]
      );

      const possibleParents = (possibleParentRows || [])
        .map((r) => String(r.inventory_item_code || "").trim())
        .filter(Boolean);

      if (possibleParents.length > 1) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: "Please open the cocktail/mocktail item (recipe) and then scan its ingredients.",
        });
      }
    }
    const [parentRows] = await connection.query(`
      SELECT inventory_item_code FROM (
        SELECT inventory_item_code FROM xxafmc_custom_cocktails_mocktails_details WHERE order_number = ? AND item_code = ?
        UNION ALL
        SELECT inventory_item_code FROM xxafmc_custom_cocktails_mocktails_details_dummy WHERE order_number = ? AND item_code = ?
        UNION ALL
        SELECT inventory_item_code
        FROM xxafmc_cocktails_mocktails_details
        WHERE item_code = ?
          AND inventory_item_code IN (
            SELECT item_id FROM xxafmc_order_details WHERE order_id = ?
          )
        UNION ALL
        SELECT CAST(item_id AS CHAR) FROM xxafmc_order_details WHERE order_id = ? AND item_id = ?
      ) x LIMIT 1`,
      [
        ORDERNUMBER,
        scanItemCode,
        ORDERNUMBER,
        scanItemCode,
        scanItemCode,
        ORDERNUMBER,
        ORDERNUMBER,
        scanItemCode,
      ]);

    const parentItem = forcedParentItem || (parentRows.length > 0 ? parentRows[0].inventory_item_code : String(scanItemCode));

    // Fetch the order_line_id for the parent item (cocktail/mocktail) from xxafmc_order_details
    let parentOrderLineId = null;
    if (parentItem) {
      const [parentOrderLineRows] = await connection.query(
        `SELECT order_line_id FROM xxafmc_order_details WHERE order_id = ? AND item_id = ? AND (order_status IS NULL OR order_status = '') LIMIT 1`,
        [ORDERNUMBER, parentItem]
      );
      if (parentOrderLineRows.length > 0) {
        parentOrderLineId = parentOrderLineRows[0].order_line_id;
      }
    }

    // Get role
    const [userRows] = await connection.query(
      `SELECT DISTINCT xu.ROLE_ID FROM xxafmc_users xu JOIN xxafmc_kitchen_notification xkn ON xu.USER_ID = xkn.USER_NAME 
       WHERE xkn.ORDERNUMBER = ? LIMIT 1`, [ORDERNUMBER]);
    const roleId = userRows.length > 0 ? Number(userRows[0].ROLE_ID) : null;

    // Get ordered quantity (l_ord_qty_item)
    // If PARENT_ITEM is provided, cap is calculated only for that cocktail/mocktail item.
    const [orderQtyRows] = await connection.query(`
      SELECT SUM(quantity) AS total_quantity FROM (
        SELECT (COALESCE(x.pegs, 1) * COALESCE(x.quantity, 0)) AS quantity FROM xxafmc_custom_cocktails_mocktails_details x 
        JOIN xxafmc_order_details xo
          ON x.inventory_item_code = xo.item_id
         AND xo.order_id = x.order_number
         AND (xo.order_status IS NULL OR xo.order_status = '')
        WHERE x.order_number = ? AND x.item_code = ?
          AND (? = '' OR x.inventory_item_code = ?)
        UNION ALL
        SELECT (COALESCE(x.pegs, 1) * COALESCE(x.quantity, 0)) AS quantity FROM xxafmc_custom_cocktails_mocktails_details_dummy x 
        JOIN xxafmc_order_details xo
          ON x.inventory_item_code = xo.item_id
         AND xo.order_id = x.order_number
         AND (xo.order_status IS NULL OR xo.order_status = '')
        WHERE x.order_number = ? AND x.item_code = ?
          AND (? = '' OR x.inventory_item_code = ?)
        UNION ALL
        SELECT (COALESCE(xcmd.pegs, 1) * COALESCE(SUM(xo.quantity), 0)) AS quantity
        FROM xxafmc_cocktails_mocktails_details xcmd
        JOIN xxafmc_order_details xo
          ON xo.item_id = xcmd.inventory_item_code
         AND xo.order_id = ?
         AND (xo.order_status IS NULL OR xo.order_status = '')
        WHERE ((? <> '' AND xcmd.inventory_item_code = ?) OR ? = '')
          AND xcmd.item_code = ?
          AND NOT EXISTS (
            SELECT 1
            FROM xxafmc_custom_cocktails_mocktails_details x
            WHERE x.inventory_item_code = xcmd.inventory_item_code
              AND x.order_number = ?
          )
          AND NOT EXISTS (
            SELECT 1
            FROM xxafmc_custom_cocktails_mocktails_details_dummy x
            WHERE x.inventory_item_code = xcmd.inventory_item_code
              AND x.order_number = ?
          )
        GROUP BY xcmd.inventory_item_code, xcmd.item_code, xcmd.pegs
        UNION ALL
        SELECT (CASE WHEN UPPER(TRIM(COALESCE(xo.type, ''))) = 'LARGE' THEN 2 ELSE 1 END * COALESCE(xo.quantity, 0)) AS quantity 
        FROM xxafmc_order_details xo 
        WHERE xo.order_id = ? AND xo.item_id = ? AND (xo.order_status IS NULL OR xo.order_status = '')
      ) a`,
      [
        ORDERNUMBER,
        scanItemCode,
        forcedParentItem,
        forcedParentItem,
        ORDERNUMBER,
        scanItemCode,
        forcedParentItem,
        forcedParentItem,
        ORDERNUMBER,
        forcedParentItem,
        forcedParentItem,
        forcedParentItem,
        scanItemCode,
        ORDERNUMBER,
        ORDERNUMBER,
        ORDERNUMBER,
        scanItemCode,
      ]);

    const orderedQty = Number(orderQtyRows[0]?.total_quantity || 0);

    if (orderedQty <= 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: `Scanned item does not belong to order ${ORDERNUMBER}` });
    }

    // === Collection metrics (like apex_collections) ===
    const scannedCollection = req.session[sessionKey] || [];

    const l_scan_item_qty = scannedCollection
      .filter(s => sameCode(s.itemCode, scanItemCode))
      .reduce((sum, s) => sum + Number(s.scanQuantity || 0), 0);

    const l_total_scanned_qty = scannedCollection
      .filter(s => sameCode(s.itemCode, scanItemCode) &&
        s.barcode === BARCODE &&
        sameCode(s.parentItem, parentItem))
      .reduce((sum, s) => sum + Number(s.scanQuantity || 0), 0);

    const l_barcode_scanned_qty = scannedCollection.filter(s => s.barcode === BARCODE).length;

    // === Exact ac_unit validation from Oracle package ===
    if (['Nos', 'Can', 'glass'].includes(acUnit)) {
      if (l_barcode_scanned_qty >= 1) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: `Alert: Duplicate bottle scan for ${BARCODE}` });
      }
      if (requestedQty > stockQuantity) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: `Alert: Entered quantity is more than the stock ${BARCODE}` });
      }
      if (orderedQty < l_scan_item_qty + requestedQty) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'Alert: Scanned quantity exceeds the ordered quantity' });
      }
    } else {
      if (l_total_scanned_qty + requestedQty > stockQuantity) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: `Alert: Scanned Quantity is more than stock for barcode ${BARCODE}` });
      }
      if (orderedQty < l_scan_item_qty + requestedQty) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'Alert: Scanned quantity exceeds the ordered quantity' });
      }
    }


    // ================= PRICE CALCULATION (FINAL - ORACLE MATCH) =================

    // STEP A: Get the pricing already chosen for this order line.
    // The kitchen user is staff, so req.user.loginType is not the customer's
    // member type at completion time.
    const targetOrderItemCode = String(parentItem || scanItemCode).trim();
    const [orderPricingRows] = await connection.query(
      `
      SELECT
        od.subcategory,
        od.profit,
        od.food_pr_charges,
        xu.login_type AS customer_login_type,
        xu.role_id AS customer_role_id
      FROM xxafmc_order_details od
      LEFT JOIN xxafmc_order_header oh
        ON oh.order_num = od.order_id
      LEFT JOIN xxafmc_users xu
        ON xu.user_id = oh.user_id
      WHERE od.item_id = ?
        AND od.order_id = ?
        AND (od.order_status IS NULL OR od.order_status = '')
      ORDER BY od.order_line_id ASC
      LIMIT 1
      `,
      [targetOrderItemCode || scanItemCode, ORDERNUMBER]
    );

    const orderPricing = orderPricingRows[0] || {};
    const subCategory = orderPricingRows.length > 0
      ? Number(orderPricing.subcategory)
      : null;


    // STEP B: Check FREE ITEM
    const [freeItemRows] = await connection.query(
      `
  SELECT item_id, price
  FROM xxafmc_order_details
  WHERE order_id = ? 
    AND item_id = ? 
    AND barcode IS NOT NULL 
    AND free_item_quantity IS NULL
  LIMIT 1
  `,
      [ORDERNUMBER, scanItemCode]
    );

    const isFreeItem = freeItemRows.length > 0 && Number(freeItemRows[0].price) === 0;


    // STEP C: Base values
    const unitPrice = Number(item.UNIT_PRICE) || 0;
    const hasOrderProfit =
      orderPricing.profit !== null &&
      orderPricing.profit !== undefined &&
      orderPricing.profit !== "";
    const hasOrderCharges =
      orderPricing.food_pr_charges !== null &&
      orderPricing.food_pr_charges !== undefined &&
      orderPricing.food_pr_charges !== "";
    const orderProfit = Number(orderPricing.profit);
    const orderCharges = Number(orderPricing.food_pr_charges);
    const isOrderNonMember =
      String(orderPricing.customer_login_type || "").trim().toUpperCase() === "NON MEMBER" ||
      (orderPricing.customer_role_id != null && Number(orderPricing.customer_role_id) !== 20);
    const fallbackProfit = isOrderNonMember ? Number(item.NON_MEMBER_PROFIT) : Number(item.PROFIT);
    const fallbackCharges = isOrderNonMember ? Number(item.PR_CHARGES) : Number(item.FOOD_PR_CHARGES);
    const profitPercent = hasOrderProfit && Number.isFinite(orderProfit) ? orderProfit : fallbackProfit || 0;
    const prCharges = hasOrderCharges && Number.isFinite(orderCharges) ? orderCharges : fallbackCharges || 0;
    const pegsFromStock = Number(item.PEGS) || 1;
    const calculatedPaidPrice = Number(
      (pegsFromStock > 0 ? unitPrice / pegsFromStock : unitPrice) * (1 + profitPercent / 100) + prCharges
    ).toFixed(2);

    const [componentRows] = await connection.query(`
      SELECT 
        item_code, 
        item_name, 
        quantity AS total_quantity, 
        inventory_item_code, 
        Mix, 
        price, 
        order_line_id,
        free_item_quantity
      FROM (
        SELECT DISTINCT x.item_code, x.item_name, (x.pegs*x.quantity) AS quantity, x.inventory_item_code, 'MO' AS Mix
             , NULL AS price, NULL AS order_line_id, NULL AS free_item_quantity
        FROM xxafmc_custom_cocktails_mocktails_details x
        JOIN xxafmc_order_details xo
          ON x.inventory_item_code = xo.item_id
         AND xo.order_id = x.order_number
         AND (xo.order_status IS NULL OR xo.order_status = '')
        WHERE x.order_number = ? AND x.item_code = ?
          AND (? = '' OR x.inventory_item_code = ?)
        UNION ALL
        SELECT DISTINCT x.item_code, x.item_name, (x.pegs*x.quantity) AS quantity, x.inventory_item_code, 'MO' AS Mix
             , NULL AS price, NULL AS order_line_id, NULL AS free_item_quantity
        FROM xxafmc_custom_cocktails_mocktails_details_dummy x
        JOIN xxafmc_order_details xo
          ON x.inventory_item_code = xo.item_id
         AND xo.order_id = x.order_number
         AND (xo.order_status IS NULL OR xo.order_status = '')
        WHERE x.order_number = ? AND x.item_code = ?
          AND (? = '' OR x.inventory_item_code = ?)
        UNION ALL
        SELECT xcmd.item_code, xcmd.item_name, (xcmd.pegs * SUM(xo.quantity)) AS quantity,
               xcmd.inventory_item_code, 'MO' AS Mix, NULL AS price, NULL AS order_line_id, NULL AS free_item_quantity
        FROM xxafmc_cocktails_mocktails_details xcmd
        JOIN xxafmc_order_details xo
          ON xo.item_id = xcmd.inventory_item_code
         AND xo.order_id = ?
         AND (xo.order_status IS NULL OR xo.order_status = '')
        WHERE ((? <> '' AND xcmd.inventory_item_code = ?) OR ? = '')
          AND xcmd.item_code = ?
          AND NOT EXISTS (
            SELECT 1
            FROM xxafmc_custom_cocktails_mocktails_details x
            WHERE x.inventory_item_code = xcmd.inventory_item_code
              AND x.order_number = ?
          )
          AND NOT EXISTS (
            SELECT 1
            FROM xxafmc_custom_cocktails_mocktails_details_dummy x
            WHERE x.inventory_item_code = xcmd.inventory_item_code
              AND x.order_number = ?
          )
        GROUP BY xcmd.inventory_item_code, xcmd.item_code, xcmd.item_name, xcmd.pegs
        UNION ALL
        SELECT COALESCE(xi.item_code, xo.ITEM_ID) AS item_code, COALESCE(xi.item_name, 'Unknown') AS item_name, (CASE WHEN UPPER(TRIM(COALESCE(xo.type, ''))) = 'LARGE' THEN 2 ELSE 1 END * xo.quantity) AS quantity,
               CAST(xo.ITEM_ID AS CHAR) AS inventory_item_code, 'I' AS Mix, xo.price, xo.order_line_id, xo.free_item_quantity
        FROM xxafmc_order_details xo LEFT JOIN (${inventorySummarySql}) xi ON xi.item_code = xo.ITEM_ID
        WHERE xo.order_id = ? AND xo.item_id = ?
      ) A`,
      [
        ORDERNUMBER,
        scanItemCode,
        forcedParentItem,
        forcedParentItem,
        ORDERNUMBER,
        scanItemCode,
        forcedParentItem,
        forcedParentItem,
        ORDERNUMBER,
        forcedParentItem,
        forcedParentItem,
        forcedParentItem,
        scanItemCode,
        ORDERNUMBER,
        ORDERNUMBER,
        ORDERNUMBER,
        scanItemCode,
      ]);
    const currentScanned = req.session[sessionKey] || [];

    let componentsWithRemaining = componentRows
      .map(comp => {
        // Fix: Subtract scans allocated ONLY to this specific line
        const already = currentScanned.filter(s => {
          if (comp.Mix === 'I' && comp.order_line_id) {
            return s.orderLineId === comp.order_line_id;
          }
          return sameCode(s.itemCode, comp.item_code) && sameCode(s.parentItem, comp.inventory_item_code);
        }).reduce((sum, s) => sum + Number(s.scanQuantity || 0), 0);

        return { ...comp, coll_qty: Math.max(0, Number(comp.total_quantity) - already) };
      })
      .filter(comp => comp.coll_qty > 0)
      .sort((a, b) => {
        // Priority: Cocktail ingredients -> Paid Standard items -> Free Standard items
        if (a.Mix !== b.Mix) return a.Mix.localeCompare(b.Mix);
        return Number(b.price || 0) - Number(a.price || 0);
      });

    // CRITICAL: If nothing left to add → show exact Oracle error
    if (componentsWithRemaining.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Warning : Scanned quantity exceeds the ordered quantity.'
      });
    }

    // Add to session (Oracle loop logic)
    let reqQtyLeft = requestedQty;
    const addedThisScan = [];

    for (const comp of componentsWithRemaining) {
      if (reqQtyLeft <= 0) break;
      const qtyToAdd = Math.min(reqQtyLeft, comp.coll_qty);

      let finalPrice = calculatedPaidPrice;
      let isFree = false;

      // Determine if this specific component is a free line
      if (comp.Mix === 'I' && Number(comp.price || 1) === 0) {
        finalPrice = 0;
        isFree = true;
        if (!comp.free_item_quantity) {
          await connection.query(
            `UPDATE xxafmc_order_details SET free_item_quantity = '1' WHERE order_line_id = ?`,
            [comp.order_line_id]
          );
        }
      }

      const newEntry = {
        id: Date.now() + addedThisScan.length,
        itemCode: comp.item_code,
        itemName: comp.item_name,
        scanQuantity: qtyToAdd,
        itemPrice: finalPrice,
        lineTotalPrice: Number((Number(finalPrice || 0) * qtyToAdd).toFixed(2)),
        barcode: BARCODE,
        orderLineId: comp.Mix === 'MO' ? parentOrderLineId : comp.order_line_id, // Use parent's order_line_id for ingredients
        scannedAt: new Date().toISOString(),
        parentItem: comp.inventory_item_code,
        categoryId,
        subCategory: item.SUB_CATEGORY,
        isFreeItem: isFree,
        isCocktailIngredient: comp.Mix === 'MO',
        pegs: Number(item.PEGS) || 1,
        roleId,
        acUnit
      };

      req.session[sessionKey] = req.session[sessionKey] || [];
      req.session[sessionKey].push(newEntry);
      addedThisScan.push(newEntry);

      reqQtyLeft -= qtyToAdd;
    }

    await connection.commit();
    transactionCommitted = true;
    await saveSession(req);

    // Final Response - Only success if we actually added something
    return res.status(201).json({
      success: true,
      message: "Barcode scanned successfully",
      data: {
        itemCode: scanItemCode,
        itemName: item.ITEM_NAME,
        calculatedPrice: addedThisScan.reduce(
          (sum, entry) => sum + Number(entry.lineTotalPrice ?? (Number(entry.itemPrice || 0) * Number(entry.scanQuantity || 0))),
          0
        ).toFixed(2),
        barcode: BARCODE,
        isCocktailIngredient: addedThisScan.some((entry) => entry.isCocktailIngredient),
        addedThisScan
      }
    });

  } catch (error) {
    if (connection && !transactionCommitted) await connection.rollback();
    console.error("Barcode scan error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process scan",
      error: error?.message || String(error),
    });
  } finally {
    if (connection) connection.release();
  }
};

exports.getScannedItemsFromSession = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const sessionKey = getScanSessionKey(req, orderNumber);
    const scannedItems = req.session[sessionKey] || [];

    return res.status(200).json({
      success: true,
      data: scannedItems,
    });
  } catch (error) {
    console.error("Error getting scanned items from session:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get scanned items",
      error: error.message,
    });
  }
};

exports.clearScannedItemsFromSession = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const sessionKey = getScanSessionKey(req, orderNumber);
    delete req.session[sessionKey];
    await saveSession(req);

    return res.status(200).json({
      success: true,
      message: "Scanned items cleared from session",
    });
  } catch (error) {
    console.error("Error clearing scanned items from session:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to clear scanned items",
      error: error.message,
    });
  }
};




exports.getActiveBarOrders = async (req, res) => {
  try {
    // console.log("Fetching active bar orders with query:", req.query);
    const kitchen = req.query.kitchen || "Bar";
    const isBar = kitchen === "Bar";
    const categoryName = isBar ? "Liquor" : "Snacks";

   const [rows] = await pool.query(
  `SELECT kn.*
   FROM xxafmc_kitchen_notification kn
   JOIN xxafmc_inventory inv ON kn.item_id = inv.item_code
   JOIN xxafmc_categories ct ON inv.category_id = ct.category_id
   WHERE kn.MSG_READ = 'N'
     AND ct.category_name = ?
   ORDER BY kn.ORDERNUMBER DESC`,
  [categoryName]
);
    // console.log("Active bar orders:", rows);
    res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error("Error fetching kitchen notifications:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch kitchen notifications",
    });
  }
};


exports.markNotificationAsRead = async (req, res) => {
  try {
    const { notification_id } = req.body;
    // Validate input
    if (!notification_id) {
      return res.status(400).json({
        success: false,
        message: "Notification ID is required",
      });
    }

    // Update query
    const [result] = await pool.query(
      `UPDATE xxafmc_kitchen_notification 
       SET MSG_READ = 'Y' 
       WHERE NOTIFICATION_ID = ?`,
      [notification_id]
    );

    // Check if any row was updated
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    // Success response
    res.status(200).json({
      success: true,
      message: "Notification marked as read",
    });

  } catch (error) {
    console.error("Error updating notification:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update notification",
    });
  }
};

exports.markAllNotificationsAsRead = async (req, res) => {
  try {
    const kitchen = req.body?.kitchen || req.query?.kitchen || "Bar";
    const isBar = normalizeKitchen(kitchen) === "Bar";
    const categoryName = isBar ? "Liquor" : "Snacks";

    const [result] = await pool.query(
      `UPDATE xxafmc_kitchen_notification kn
       JOIN xxafmc_inventory inv ON kn.item_id = inv.item_code
       JOIN xxafmc_categories ct ON inv.category_id = ct.category_id
       SET kn.MSG_READ = 'Y'
       WHERE kn.MSG_READ = 'N'
         AND ct.category_name = ?`,
      [categoryName]
    );

    res.status(200).json({
      success: true,
      message: "Notifications marked as read",
      count: result.affectedRows || 0,
    });
  } catch (error) {
    console.error("Error clearing notifications:", error);

    res.status(500).json({
      success: false,
      message: "Failed to clear notifications",
    });
  }
};



// Get cocktail/mocktail details by ID for ingredient modal
exports.getCocktailDetailsById = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { orderNumber } = req.query; // You might need order number too

    if (!itemId) {
      return res.status(400).json({
        success: false,
        message: "Item ID is required",
      });
    }

    // Get cocktail basic info first
    const [cocktailInfo] = await pool.query(
      `
      SELECT 
        xi.ITEM_CODE,
        xi.ITEM_NAME,
        xi.SUB_CATEGORY
      FROM xxafmc_inventory xi
      WHERE xi.ITEM_CODE = ?
      `,
      [itemId]
    );

    if (cocktailInfo.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Cocktail/Mocktail not found",
      });
    }

    // Get ingredients - based on your SQL logic
    const [ingredients] = await pool.query(
      `
      SELECT DISTINCT 
        XCMD.ITEM_NAME,
        XCMD.ITEM_CODE,
        XCMD.PEGS,
        COALESCE(XOD.QUANTITY, XCMD.QUANTITY) AS QUANTITY
      FROM xxafmc_order_details XOD
      JOIN xxafmc_custom_cocktails_mocktails_details XCMD ON XOD.ITEM_ID = XCMD.INVENTORY_ITEM_CODE
      WHERE XOD.ORDER_ID = ?
        AND XCMD.ORDER_NUMBER = ?
        AND XCMD.INVENTORY_ITEM_CODE = ?

      UNION

      SELECT DISTINCT 
        XCMD.ITEM_NAME,
        XCMD.ITEM_CODE,
        XCMD.PEGS,
        COALESCE(XOD.QUANTITY, XCMD.QUANTITY) AS QUANTITY
      FROM xxafmc_order_details XOD
      JOIN xxafmc_custom_cocktails_mocktails_details_dummy XCMD ON XOD.ITEM_ID = XCMD.INVENTORY_ITEM_CODE
      WHERE XOD.ORDER_ID = ?
        AND XCMD.ORDER_NUMBER = ?
        AND XCMD.INVENTORY_ITEM_CODE = ?
      
      UNION
      
      SELECT DISTINCT 
        XCMD.ITEM_NAME,
        XCMD.ITEM_CODE,
        XCMD.PEGS,
        COALESCE(XOD.QUANTITY, XCMD.QUANTITY) AS QUANTITY
      FROM xxafmc_order_details XOD
      JOIN xxafmc_cocktails_mocktails_details XCMD ON XOD.ITEM_ID = XCMD.INVENTORY_ITEM_CODE
      WHERE XOD.ORDER_ID = ?
        AND XCMD.INVENTORY_ITEM_CODE = ?
        AND NOT EXISTS (
          SELECT 1 
          FROM xxafmc_custom_cocktails_mocktails_details X 
          WHERE X.INVENTORY_ITEM_CODE = XCMD.INVENTORY_ITEM_CODE
            AND X.ORDER_NUMBER = ?
        )
      `,
      [orderNumber, orderNumber, itemId, orderNumber, orderNumber, itemId, orderNumber, itemId, orderNumber]
    );

    if (ingredients.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No ingredients found for this cocktail/mocktail",
      });
    }

    // Format response to match your frontend's expected structure
    const response = {
      success: true,
      data: {
        ITEM_CODE: cocktailInfo[0].ITEM_CODE,
        ITEM_NAME: cocktailInfo[0].ITEM_NAME,
        SUB_CATEGORY: cocktailInfo[0].SUB_CATEGORY,
        details: ingredients.map(ing => ({
          ITEM_CODE: ing.ITEM_CODE,
          ITEM_NAME: ing.ITEM_NAME,
          PEGS: ing.PEGS,
          QUANTITY: ing.QUANTITY || 1
        }))
      }
    };

    res.status(200).json(response);

  } catch (error) {
    console.error("Error fetching cocktail details:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch cocktail details",
      error: error.message,
    });
  }
};



exports.getCancelledOrders = async (req, res) => {
  try {
    let { fromDate, toDate, kitchen = "Bar" } = req.query;
    const { categoryId } = getKitchenConfig(kitchen);


    //   Normalize input dates (important)
    const from = getStartOfDay(fromDate);
    const to = getEndOfDay(toDate);

    const dateExpression = `
      CASE 
        WHEN xxkn.order_date LIKE '%/%' THEN STR_TO_DATE(xxkn.order_date, '%m/%d/%Y')
        ELSE DATE(xxkn.order_date)
      END
    `;

    const query = `
  SELECT 
      xxkn.order_num,
      xxkn.order_date,

      COALESCE(NULLIF(TRIM(xnm.first_name), ''), NULLIF(TRIM(xu.first_name), ''), CONCAT('Order ', xxkn.order_num)) AS first_name,

      COALESCE(
        NULLIF(
          CONCAT(
            UPPER(LEFT(TRIM(xp.pubmed_name), 1)),
            LOWER(SUBSTRING(TRIM(xp.pubmed_name), 2))
          ),
          ''
        ),
        NULLIF(TRIM(CAST(xxkn.pubmed AS CHAR)), ''),
        'N/A'
      ) AS pubmed_name

  FROM xxafmc_order_header xxkn

  LEFT JOIN xxafmc_non_members xnm 
      ON xnm.id = xxkn.member_id

  LEFT JOIN xxafmc_users xu 
      ON xu.user_id = xxkn.user_id

  LEFT JOIN xxafmc_pubmed xp 
      ON TRIM(CAST(xp.pubmed_id AS CHAR)) = TRIM(CAST(xxkn.pubmed AS CHAR))
      OR UPPER(TRIM(xp.pubmed_name) COLLATE utf8mb4_unicode_ci) =
        UPPER(TRIM(CAST(xxkn.pubmed AS CHAR)) COLLATE utf8mb4_unicode_ci)

  WHERE EXISTS (
      SELECT 1
      FROM xxafmc_order_details xod
      JOIN (${inventorySummarySql}) inv 
          ON inv.item_code = xod.item_id
      WHERE xod.order_id = xxkn.order_num
        AND inv.category_id = ?
      GROUP BY xod.order_id
      HAVING COUNT(*) > 0
        AND COUNT(*) = SUM(
          CASE
            WHEN TRIM(UPPER(IFNULL(xod.order_status, ''))) = 'CANCELLED'
            THEN 1
            ELSE 0
          END
        )
  )

  AND ${dateExpression} 
      BETWEEN COALESCE(?, CURDATE()) 
      AND COALESCE(?, CURDATE())

  ORDER BY xxkn.order_num DESC
`;

    const [rows] = await pool.execute(query, [
      categoryId,
      from || null,
      to || null
    ]);

    res.json({
      success: true,
      count: rows.length,
      data: rows,
    });

  } catch (err) {
    console.error("Error in getCancelledOrders:", err);

    res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch cancelled orders",
    });

  }
};

exports.cancelBarOrderItem = async (req, res) => {
  let connection;
  try {
    const { ORDER_LINE_ID, ORDERNUMBER, KITCHEN = "Bar" } = req.body;
    const { categoryId } = getKitchenConfig(KITCHEN);
console.log("Cancel request received with:", { ORDER_LINE_ID, ORDERNUMBER, KITCHEN, categoryId });

    if (!ORDERNUMBER && !ORDER_LINE_ID) {
      return res.status(400).json({
        success: false,
        message: "Order line ID or order number is required",
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    if (ORDERNUMBER) {
      console.log("Complete order cancel - Order number:", { ORDERNUMBER, categoryId });

      const reservationRows = await getReservationReleaseRowsForCancel(connection, {
        orderNumber: ORDERNUMBER,
        categoryId,
      });

      console.log("Reservation rows to release for complete order:", reservationRows);

      const [updateResult] = await connection.query(
        `
        UPDATE xxafmc_order_details xod
        JOIN (${inventorySummarySql}) inv ON inv.item_code = xod.item_id
        SET xod.ORDER_STATUS = 'CANCELLED'
        WHERE xod.ORDER_ID = ?
          AND inv.category_id = ?
          AND (xod.ORDER_STATUS IS NULL OR TRIM(xod.ORDER_STATUS) = '')
        `,
        [ORDERNUMBER, categoryId]
      );

      await releaseReservationRows(connection, reservationRows);

      await connection.query(
        `
        UPDATE xxafmc_kitchen_notification kn
        JOIN (${inventorySummarySql}) inv ON inv.item_code = kn.item_id
        SET kn.status = 'Cancelled'
        WHERE kn.ordernumber = ?
          AND inv.category_id = ?
          AND kn.status IN ('Received', 'Preparing')
        `,
        [ORDERNUMBER, categoryId]
      );

      await connection.commit();

      return res.status(200).json({
        success: true,
        message: updateResult.affectedRows > 0
          ? "Order cancelled successfully"
          : "No cancellable order items found",
      });
    }

    // First get the order_id and category info from this line item
    const [lineItems] = await connection.query(
      `
      SELECT xod.order_id, xi.category_id, xod.item_id
      FROM xxafmc_order_details xod
      LEFT JOIN (${inventorySummarySql}) xi ON xi.item_code = xod.item_id
      WHERE xod.ORDER_LINE_ID = ?
        AND (xod.ORDER_STATUS IS NULL OR TRIM(xod.ORDER_STATUS) = '')
      `,
      [ORDER_LINE_ID]
    );

    if (lineItems.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Order item not found or already processed",
      });
    }

    const lineItem = lineItems[0];
    const lineCategoryId = Number(lineItem.category_id) || categoryId;

    console.log("Single item cancel - Line item details:", { 
      ORDER_LINE_ID, 
      orderId: lineItem.order_id,
      itemId: lineItem.item_id,
      lineCategoryId 
    });

    const reservationRows = await getReservationReleaseRowsForCancel(connection, {
      orderLineId: ORDER_LINE_ID,
      categoryId: lineCategoryId,
    });

    console.log("Reservation rows to release:", reservationRows);

    const [updateResult] = await connection.query(
      `
      UPDATE xxafmc_order_details
      SET ORDER_STATUS = 'CANCELLED'
      WHERE ORDER_LINE_ID = ?
        AND (ORDER_STATUS IS NULL OR TRIM(ORDER_STATUS) = '')
      `,
      [ORDER_LINE_ID]
    );

    if (updateResult.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Order item not found or already processed",
      });
    }

    await releaseReservationRows(connection, reservationRows);

    await connection.query(
      `UPDATE xxafmc_kitchen_notification kn
       SET kn.status = 'Cancelled'
       WHERE EXISTS (
         SELECT 1 FROM xxafmc_order_details od
         WHERE od.order_line_id = ? AND od.order_id = kn.ordernumber AND od.item_id = kn.item_id
       )`,
      [ORDER_LINE_ID]
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: "Order item cancelled successfully",
    });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (_) { }
    }
    console.error("Error cancelling bar order item:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to cancel order item",
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

exports.getOrderHistory = async (req, res) => {
  try {
    const { fromDate, toDate, page = 1, limit = 10, kitchen = "Bar" } = req.query;
    const { categoryId } = getKitchenConfig(kitchen);
    // console.log("Fetching order history with params:", { fromDate, toDate, page, limit });
    let from = getStartOfDay(fromDate);
    let to = getEndOfDay(toDate);

    if (!from) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      from = getStartOfDay(thirtyDaysAgo);
    }
    if (!to) to = getEndOfDay(new Date());

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const dateExpression = `
      CASE
        WHEN nm.order_date LIKE '%/%' THEN STR_TO_DATE(nm.order_date, '%m/%d/%Y')
        ELSE DATE(nm.order_date)
      END
    `;

    const query = `
    SELECT 
  kn.ordernumber AS order_num,
  nm.order_date,

   COALESCE(NULLIF(TRIM(xnm.first_name), ''), NULLIF(TRIM(xu.first_name), ''), CONCAT('Order ', kn.ordernumber)) AS first_name,
   COALESCE(NULLIF(TRIM(xnm.phone_number), ''), NULLIF(TRIM(xu.phone_number), ''), '') AS phone_number,

  COALESCE(
    CONCAT(UPPER(LEFT(xp.pubmed_name, 1)), LOWER(SUBSTRING(xp.pubmed_name, 2))),
    'N/A'
  ) AS pubmed_name,

  FORMAT(IFNULL(MAX(order_totals.subtotal), 0), 2) AS subtotal,

  CASE
    WHEN SUM(CASE WHEN UPPER(kn.status) = 'CANCELLED' THEN 1 ELSE 0 END) = COUNT(*)
    THEN 'CANCELLED'

    WHEN SUM(CASE WHEN UPPER(kn.status) = 'PREPARING' THEN 1 ELSE 0 END) > 0
         AND SUM(CASE WHEN UPPER(kn.status) = 'COMPLETED' THEN 1 ELSE 0 END) > 0
    THEN 'PARTIALLY COMPLETED'

    WHEN SUM(CASE WHEN UPPER(kn.status) = 'RECEIVED' THEN 1 ELSE 0 END) > 0
         AND SUM(CASE WHEN UPPER(kn.status) = 'COMPLETED' THEN 1 ELSE 0 END) > 0
    THEN 'PARTIALLY COMPLETED'

    WHEN SUM(CASE WHEN UPPER(kn.status) IN ('COMPLETED','CANCELLED') THEN 1 ELSE 0 END) = COUNT(*)
    THEN 'COMPLETED'

    ELSE 'PREPARING'
  END AS status

FROM xxafmc_kitchen_notification kn
JOIN (${inventorySummarySql}) inv
  ON inv.item_code = kn.item_id

LEFT JOIN xxafmc_order_header nm 
  ON nm.order_num = kn.ordernumber

LEFT JOIN xxafmc_non_members xnm 
  ON xnm.id = nm.member_id

LEFT JOIN xxafmc_users xu 
  ON xu.user_id = nm.user_id

LEFT JOIN xxafmc_pubmed xp 
  ON xp.pubmed_id = nm.pubmed

LEFT JOIN (
  SELECT
    od.order_id,
    ROUND(SUM(
      CASE
        WHEN IFNULL(od.price, 0) = 0 OR UPPER(TRIM(IFNULL(od.type, ''))) = 'FREE ITEM' THEN 0
        WHEN scanned_totals.scanned_total > 0 THEN scanned_totals.scanned_total
        WHEN custom_totals.unit_custom_total > 0 THEN custom_totals.unit_custom_total * od.quantity
        ELSE IFNULL(od.subtotal, 0)
      END
    ), 2) AS subtotal
  FROM xxafmc_order_details od
  JOIN (${inventorySummarySql}) total_inv
    ON total_inv.item_code = od.item_id
  LEFT JOIN (
    SELECT
      order_number,
      inventory_item_code,
      ROUND(SUM(IFNULL(scan_quantity, 0) * IFNULL(item_price, 0)), 2) AS scanned_total
    FROM order_scan_collection
    WHERE collection_name = 'S_COLLECTION'
    GROUP BY order_number, inventory_item_code
  ) scanned_totals
    ON scanned_totals.order_number = od.order_id
    AND scanned_totals.inventory_item_code = od.item_id
  LEFT JOIN (
    SELECT
      cm.order_number,
      cm.inventory_item_code,
      ROUND(SUM(
        IFNULL(cm.pegs, 0) *
        (
          IFNULL(stock_prices.base_peg_price, 0) * (1 + IFNULL(od_price.profit, 0) / 100) +
          IFNULL(od_price.food_pr_charges, 0)
        )
      ), 2) AS unit_custom_total
    FROM xxafmc_custom_cocktails_mocktails_details cm
    JOIN xxafmc_order_details od_price
      ON od_price.order_id = cm.order_number
      AND od_price.item_id = cm.inventory_item_code
    LEFT JOIN (
      SELECT
        item_code,
        MAX(IFNULL(unit_price, 0) / IFNULL(NULLIF(pegs, 0), 1)) AS base_peg_price
      FROM xxafmc_stock_out
      WHERE IFNULL(stock_quantity, 0) > 0
      GROUP BY item_code
    ) stock_prices
      ON stock_prices.item_code = cm.item_code
    GROUP BY cm.order_number, cm.inventory_item_code
  ) custom_totals
    ON custom_totals.order_number = od.order_id
    AND custom_totals.inventory_item_code = od.item_id
  WHERE total_inv.category_id = ?
    AND TRIM(UPPER(IFNULL(od.order_status, ''))) != 'CANCELLED'
  GROUP BY od.order_id
) order_totals
  ON order_totals.order_id = kn.ordernumber

WHERE inv.category_id = ?
  AND ${dateExpression} BETWEEN ? AND ?

GROUP BY kn.ordernumber, nm.order_date, first_name, phone_number, xp.pubmed_name

HAVING 
  SUM(CASE WHEN UPPER(kn.status) = 'COMPLETED' THEN 1 ELSE 0 END) > 0

ORDER BY kn.ordernumber DESC
LIMIT ? OFFSET ?
`;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM (
        SELECT kn.ordernumber
        FROM xxafmc_kitchen_notification kn
        JOIN (${inventorySummarySql}) inv
          ON inv.item_code = kn.item_id
        LEFT JOIN xxafmc_order_header nm 
          ON nm.order_num = kn.ordernumber
        WHERE inv.category_id = ?
          AND ${dateExpression} BETWEEN ? AND ?
        GROUP BY kn.ordernumber
        HAVING SUM(CASE WHEN UPPER(kn.status) = 'COMPLETED' THEN 1 ELSE 0 END) > 0
      ) history_orders
    `;

    const dateParams = [categoryId, from, to];

    const [countResult] = await pool.execute(countQuery, dateParams);
    const totalRecords = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalRecords / limitNum);

    // Critical fix for MySQL 8.0.22+ bug
    const queryParams = [categoryId, categoryId, from, to, String(limitNum), String(offset)];

    const [rows] = await pool.execute(query, queryParams);


    res.json({
      success: true,
      data: rows,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalRecords,
        recordsPerPage: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
        nextPage: pageNum < totalPages ? pageNum + 1 : null,
        prevPage: pageNum > 1 ? pageNum - 1 : null
      }
    });

  } catch (err) {
    console.error("❌ Order History Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order history",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.getOrderHistoryItemDetails = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { kitchen = "Bar" } = req.query;
    const { categoryId } = getKitchenConfig(kitchen);
    // console.log("Fetching item details for order:", orderNumber);
    if (!orderNumber) {
      return res.status(400).json({
        success: false,
        message: "Order number is required"
      });
    }

    // 🔹 Item details query
    const itemsQuery = `
      SELECT 
        xo.order_line_id,
        xo.order_id,
        xo.item_id,
        IFNULL(xo.type, 'NA') AS type,
        xi.item_name,
        xo.quantity,

        ROUND(
          CASE
            WHEN IFNULL(xo.price, 0) = 0 OR UPPER(TRIM(IFNULL(xo.type, ''))) = 'FREE ITEM' THEN 0
            WHEN MAX(scanned_totals.scanned_total) > 0 THEN MAX(scanned_totals.scanned_total)
            WHEN MAX(custom_totals.unit_custom_total) > 0 THEN MAX(custom_totals.unit_custom_total) * xo.quantity
            ELSE IFNULL(xo.subtotal, 0)
          END,
          2
        ) AS subtotal,
        ROUND(
          CASE
            WHEN MAX(scanned_totals.scanned_total) > 0 THEN MAX(scanned_totals.scanned_total) / NULLIF(xo.quantity, 0)
            WHEN MAX(custom_totals.unit_custom_total) > 0 THEN MAX(custom_totals.unit_custom_total)
            ELSE COALESCE(xo.price, xo.subtotal / NULLIF(xo.quantity, 0), 0)
          END - IFNULL(xo.food_pr_charges, 0),
          2
        ) AS price,
        IFNULL(xo.food_pr_charges, 0) AS pr_charges,

        xo.created_by,
        xo.creation_date,
        xo.last_updated_date,
        xo.last_updated_by,

        COALESCE(
          NULLIF(xo.order_status, ''), 
          MAX(
            CASE 
              WHEN xxkn.status = 'Completed' THEN '3-Completed'
              WHEN xxkn.status = 'Preparing' THEN '2-Preparing'
              ELSE '1-Received'
            END), 
          NULLIF(oh.order_status, ''), 
          'Received'
        ) AS status

      FROM xxafmc_order_details xo

      LEFT JOIN xxafmc_order_header oh
        ON oh.order_num = xo.order_id

      JOIN (${inventorySummarySql}) xi
        ON xo.item_id = xi.item_code

      LEFT JOIN (
        SELECT
          order_number,
          inventory_item_code,
          ROUND(SUM(IFNULL(scan_quantity, 0) * IFNULL(item_price, 0)), 2) AS scanned_total
        FROM order_scan_collection
        WHERE collection_name = 'S_COLLECTION'
        GROUP BY order_number, inventory_item_code
      ) scanned_totals
        ON scanned_totals.order_number = xo.order_id
       AND scanned_totals.inventory_item_code = xo.item_id

      LEFT JOIN (
        SELECT
          cm.order_number,
          cm.inventory_item_code,
          ROUND(SUM(
            IFNULL(cm.pegs, 0) *
            (
              IFNULL(stock_prices.base_peg_price, 0) * (1 + IFNULL(od_price.profit, 0) / 100) +
              IFNULL(od_price.food_pr_charges, 0)
            )
          ), 2) AS unit_custom_total
        FROM xxafmc_custom_cocktails_mocktails_details cm
        JOIN xxafmc_order_details od_price
          ON od_price.order_id = cm.order_number
         AND od_price.item_id = cm.inventory_item_code
        LEFT JOIN (
          SELECT
            item_code,
            MAX(IFNULL(unit_price, 0) / IFNULL(NULLIF(pegs, 0), 1)) AS base_peg_price
          FROM xxafmc_stock_out
          WHERE IFNULL(stock_quantity, 0) > 0
          GROUP BY item_code
        ) stock_prices
          ON stock_prices.item_code = cm.item_code
        GROUP BY cm.order_number, cm.inventory_item_code
      ) custom_totals
        ON custom_totals.order_number = xo.order_id
       AND custom_totals.inventory_item_code = xo.item_id

      --   critical join (same as APEX)
      LEFT JOIN xxafmc_kitchen_notification xxkn 
        ON xxkn.ordernumber = xo.order_id
       AND TRIM(CAST(xxkn.item_id AS CHAR)) = TRIM(CAST(xo.item_id AS CHAR))

      WHERE xo.order_id = ?
        AND xi.category_id = ?

      GROUP BY 
        xo.order_line_id,
        xo.order_id,
        xo.item_id,
        xo.type,
        xi.item_name,
        xo.quantity,
        xo.price,
        xo.subtotal,
        xo.order_status,
        xo.food_pr_charges,
        xo.created_by,
        xo.creation_date,
        xo.last_updated_date,
        xo.last_updated_by,
        oh.order_status
      ORDER BY xo.order_line_id
    `;

    // 🔹 Total query
    const totalQuery = `
      SELECT 
        ROUND(SUM(
          CASE
            WHEN IFNULL(xo.price, 0) = 0 OR UPPER(TRIM(IFNULL(xo.type, ''))) = 'FREE ITEM' THEN 0
            WHEN scanned_totals.scanned_total > 0 THEN scanned_totals.scanned_total
            WHEN custom_totals.unit_custom_total > 0 THEN custom_totals.unit_custom_total * xo.quantity
            ELSE IFNULL(xo.subtotal, 0)
          END
        ), 2) AS total_amount
      FROM xxafmc_order_details xo
      JOIN (${inventorySummarySql}) xi
        ON xo.item_id = xi.item_code
      LEFT JOIN (
        SELECT
          order_number,
          inventory_item_code,
          ROUND(SUM(IFNULL(scan_quantity, 0) * IFNULL(item_price, 0)), 2) AS scanned_total
        FROM order_scan_collection
        WHERE collection_name = 'S_COLLECTION'
        GROUP BY order_number, inventory_item_code
      ) scanned_totals
        ON scanned_totals.order_number = xo.order_id
        AND scanned_totals.inventory_item_code = xo.item_id
      LEFT JOIN (
        SELECT
          cm.order_number,
          cm.inventory_item_code,
          ROUND(SUM(
            IFNULL(cm.pegs, 0) *
            (
              IFNULL(stock_prices.base_peg_price, 0) * (1 + IFNULL(od_price.profit, 0) / 100) +
              IFNULL(od_price.food_pr_charges, 0)
            )
          ), 2) AS unit_custom_total
        FROM xxafmc_custom_cocktails_mocktails_details cm
        JOIN xxafmc_order_details od_price
          ON od_price.order_id = cm.order_number
          AND od_price.item_id = cm.inventory_item_code
        LEFT JOIN (
          SELECT
            item_code,
            MAX(IFNULL(unit_price, 0) / IFNULL(NULLIF(pegs, 0), 1)) AS base_peg_price
          FROM xxafmc_stock_out
          WHERE IFNULL(stock_quantity, 0) > 0
          GROUP BY item_code
        ) stock_prices
          ON stock_prices.item_code = cm.item_code
        GROUP BY cm.order_number, cm.inventory_item_code
      ) custom_totals
        ON custom_totals.order_number = xo.order_id
        AND custom_totals.inventory_item_code = xo.item_id
      WHERE xo.order_id = ?
        AND xi.category_id = ?
    `;

    const [items] = await pool.execute(itemsQuery, [orderNumber, categoryId]);
    const [totalResult] = await pool.execute(totalQuery, [orderNumber, categoryId]);

    // Clean up the status string if it used the priority prefix
    const formattedItems = items.map(item => ({
      ...item,
      status: item.status.replace(/^\d-/, '')
    }));

    const totalAmount = totalResult[0]?.total_amount || 0;
    res.json({
      success: true,
      data: {
        orderNumber,
        items: formattedItems,
        summary: {
          totalAmount
        }
      }
    });

  } catch (err) {
    console.error("❌ Order Item Details Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order item details",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};


exports.getOrderDetailsByOrderNumber = async (req, res) => {
  let connection;

  try {
    const { orderNumber } = req.params;
    const { kitchen = "Bar" } = req.query;
    const { categoryId } = getKitchenConfig(kitchen);
console.log("Fetching order details for order number:", orderNumber, "and kitchen:", kitchen);
    if (!orderNumber) {
      return res.status(400).json({
        success: false,
        message: "Order number is required"
      });
    }

    // Get connection from pool
    connection = await pool.getConnection();

    // The query using ? as a placeholder for MySQL
    const sql = `
      SELECT 
        xod.item_id,
        inv.item_name,
        xod.quantity,
        COALESCE(xod.type, 'NA') AS type,
        'Cancelled' AS status
      FROM xxafmc_order_details xod
      LEFT JOIN (${inventorySummarySql}) inv
        ON inv.item_code = xod.item_id
      LEFT JOIN xxafmc_kitchen_notification xkn 
        ON xod.order_id = xkn.ordernumber 
        AND TRIM(CAST(xkn.item_id AS CHAR)) = TRIM(CAST(xod.item_id AS CHAR))
      WHERE xod.order_id = ?
        AND inv.category_id = ?
        AND TRIM(UPPER(IFNULL(xod.order_status, ''))) = 'CANCELLED'
      GROUP BY xod.item_id, xod.quantity, xod.type, xod.order_status, inv.item_name
    `;

    const [rows] = await connection.execute(sql, [orderNumber, categoryId]);

    // Clean up status prefix if priority logic was used
    const formattedRows = rows.map(row => ({
      ...row,
      status: row.status ? String(row.status).replace(/^\d-/, '') : 'Received'
    }));

    console.log("Fetched order details:", formattedRows.length, "items");

    res.json({
      success: true,
      count: formattedRows.length,
      data: formattedRows
    });

  } catch (err) {
    console.error("❌ Error fetching order details:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error"
    });

  } finally {
    if (connection) {

      connection.release();
    }
  }
};


exports.completeOrder = async (req, res) => {
  let connection;

  try {
    const {
      ORDERNUMBER,
      KITCHEN = "Bar",
      STATUS = "Completed"
    } = req.body;



    if (!ORDERNUMBER) {
      return res.status(400).json({
        success: false,
        message: "Order number is required"
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const { categoryId } = getKitchenConfig(KITCHEN);
    const [[pendingOutletRow]] = await connection.query(
      `
      SELECT COUNT(*) AS pending_count
      FROM xxafmc_kitchen_notification kn
      JOIN (${inventorySummarySql}) inv
        ON inv.item_code = kn.item_id
      WHERE kn.ordernumber = ?
        AND inv.category_id = ?
        AND kn.status IN ('Received', 'Preparing')
      `,
      [ORDERNUMBER, categoryId]
    );

    if (Number(pendingOutletRow?.pending_count || 0) > 0) {
      await validateScansBeforeComplete(connection, req, ORDERNUMBER, KITCHEN);
    }

    // 1. Update order header
    const [headerResult] = await connection.query(
      `
      UPDATE xxafmc_order_header
      SET 
        order_status = ?,
        kitchen_type = ?,
        order_total = (
          SELECT ROUND(SUM(IFNULL(subtotal, 0)), 2)
          FROM xxafmc_order_details
          WHERE order_id = ?
            AND TRIM(UPPER(IFNULL(order_status, ''))) != 'CANCELLED'
        )
      WHERE order_num = ?
      `,
      [
        STATUS,
        KITCHEN,
        ORDERNUMBER,
        ORDERNUMBER
      ]
    );



    await connection.commit();

    return res.status(200).json({
      success: true,
      message:
        headerResult.affectedRows > 0
          ? "Order completed successfully"
          : "No order found"
    });

  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) { }
    }

    console.error("Error completing order:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : "Failed to complete order",
      error: error.message
    });

  } finally {
    if (connection) {
      connection.release();
    }
  }
};
