const pool = require("../config/db");

exports.getOrders = async (req, res) => {
  try {
    const appUser = req.user?.user_name || req.user?.username || "";
    const kitchen = req.query.kitchen || "Bar";

    const isBar = kitchen === "Bar";

    const categoryName = isBar ? "Liquor" : "Snacks";
    const handledByColumn = isBar
      ? "a.HANDLED_BY_bar"
      : "a.HANDLED_BY_kitchen";

    // console.log(`Fetching ${kitchen} orders for user: ${appUser}`);

    const query = `
      SELECT * FROM (
        SELECT
          a.ordernumber AS ORDERNUMBER,

          MAX(
            COALESCE(
              (SELECT xnm.FIRST_NAME FROM xxafmc_non_members xnm WHERE xnm.ID = oh.member_id),
              (SELECT xu2.FIRST_NAME FROM xxafmc_users xu2 WHERE xu2.user_id = oh.user_id)
            )
          ) AS FIRST_NAME,

          MAX(a.STATUS) AS STATUS,
          MAX(a.STATUS) AS Status1,

          MAX(
            CASE
              WHEN a.STATUS = 'Completed' THEN '3-green'
              WHEN a.STATUS = 'Preparing' THEN '2-red'
              WHEN a.STATUS = 'Received' THEN '1-yellow'
            END
          ) AS COLOR,

          MAX(
            CASE
              WHEN a.STATUS = 'Completed' THEN 3
              WHEN a.STATUS = 'Preparing' THEN 2
              WHEN a.STATUS = 'Received' THEN 1
              ELSE 4
            END
          ) AS seq,

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

          MAX(
            CASE
              WHEN a.STATUS = 'Received' THEN 'Y'
              ELSE 'N'
            END
          ) AS CAN_CANCEL,

          MAX(
            CASE
              WHEN a.STATUS IN ('Received','Preparing') THEN 'Y'
              ELSE 'N'
            END
          ) AS CAN_NAVIGATE

        FROM xxafmc_kitchen_notification a
        JOIN xxafmc_inventory inv ON a.item_id = inv.item_code
        JOIN xxafmc_categories ct ON inv.category_id = ct.category_id
        JOIN xxafmc_users xu ON a.user_name = xu.user_id
        JOIN xxafmc_order_header oh ON a.ordernumber = oh.order_num

        WHERE ct.category_name = ?
          AND (
            a.STATUS IN ('Received','Completed')
            OR (
              a.STATUS IN ('Received','Preparing')
              AND ${handledByColumn} = (
                SELECT xu3.FIRST_NAME
                FROM xxafmc_users xu3
                WHERE LOWER(xu3.user_name) = LOWER(?)
              )
            )
          )

        GROUP BY a.ordernumber, a.status

      ) tbl
      ORDER BY seq ASC, ORDERNUMBER DESC
    `;

    const [rows] = await pool.query(query, [categoryName, appUser]);
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
    const appUser = req.user?.username || req.body.appUser || "";

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
    const handledByField = KITCHEN === "Bar" ? "handled_by_bar" : "handled_by_kitchen";
    const categoryName = KITCHEN === "Bar" ? "Liquor" : "Snacks";
    const normalizedStatus = String(STATUS || "Preparing").trim();

    let result;

    if (normalizedStatus === "Completed") {
      // First, get scanned items from session and insert into database
      const sessionKey = `scannedItems_${ORDERNUMBER}_${req.user?.username || 'unknown'}`;
      const scannedItems = req.session[sessionKey] || [];

      connection = await pool.getConnection();
      await connection.beginTransaction();

      // Insert scanned items + update status atomically to avoid partial/dirty state.
      if (scannedItems.length > 0) {
        const placeholders = scannedItems.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
        const values = [];

        for (const item of scannedItems) {
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
      }

      // Then update the order status
      [result] = await connection.query(
        `
        UPDATE xxafmc_kitchen_notification a
        JOIN xxafmc_inventory inv ON a.item_id = inv.item_code
        JOIN xxafmc_categories ct ON inv.category_id = ct.category_id
        SET a.status = 'Completed'
        WHERE a.ordernumber = ?
          AND a.status IN ('Received', 'Preparing')
          AND ct.category_name = ?
        `,
        [ORDERNUMBER, categoryName]
      );

      await connection.commit();

      // Clear the session only after commit succeeds.
      delete req.session[sessionKey];
    } else {
      [result] = await pool.query(
        `
        UPDATE xxafmc_kitchen_notification a
        JOIN xxafmc_inventory inv ON a.item_id = inv.item_code
        JOIN xxafmc_categories ct ON inv.category_id = ct.category_id
        SET
          a.status = 'Preparing',
          a.${handledByField} = ?
        WHERE a.ordernumber = ?
          AND a.status = 'Received'
          AND ct.category_name = ?
        `,
        [handledBy, ORDERNUMBER, categoryName]
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
    return res.status(500).json({
      success: false,
      message: "Failed to update order status",
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

    let categoryFilter = "";
    const params = [ORDERNUMBER];

    if (KITCHEN === "Bar") {
      categoryFilter = "AND xi.CATEGORY_ID = 10";
    } else if (KITCHEN === "Kitchen") {
      categoryFilter = "AND xi.CATEGORY_ID = 14";
    }
    // else → no filter (returns all)

    const query = `
  SELECT 
    xod.ORDER_LINE_ID,
    xod.ITEM_ID,
    xod.QUANTITY,
    xi.ITEM_NAME,
    COALESCE(xod.TYPE, 'NA') AS TYPE,

    CASE 
      WHEN xi.SUB_CATEGORY IN (14, 15) THEN 'Y'
      ELSE 'N'
    END AS LINK_ENABLED,

    'Y' AS CAN_CANCEL

  FROM xxafmc_order_details xod

  LEFT JOIN (
    SELECT 
      ITEM_CODE,
      ITEM_NAME,
      SUB_CATEGORY,
      CATEGORY_ID,
      ROW_NUMBER() OVER (
        PARTITION BY ITEM_CODE 
        ORDER BY (UNIT_PRICE IS NULL), UNIT_PRICE DESC, ITEM_NAME
      ) as rn
    FROM xxafmc_inventory
  ) xi 
    ON xod.ITEM_ID = xi.ITEM_CODE 
   AND xi.rn = 1

  WHERE xod.ORDER_ID = ?
    AND (xod.ORDER_STATUS IS NULL OR xod.ORDER_STATUS = '')
    ${categoryFilter}

  ORDER BY xod.ORDER_LINE_ID ASC;
`;

    const [rows] = await pool.query(query, [ORDERNUMBER]);

    const formattedData = rows.map((row) => ({
      ORDER_LINE_ID: row.ORDER_LINE_ID,
      ITEM_ID: row.ITEM_ID,
      quantity: Number(row.QUANTITY) || 0,
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
  try {
    const { ORDERNUMBER, BARCODE, QUANTITY = 1, KITCHEN = "Bar" } = req.body;

    if (!ORDERNUMBER || !BARCODE) {
      return res.status(400).json({ success: false, message: "Order number and barcode are required" });
    }

    const requestedQty = Number(QUANTITY) || 1;
    const sessionKey = `scannedItems_${ORDERNUMBER}_${req.user?.username || 'unknown'}`;

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // STEP 1: Get item details
    const [itemRows] = await connection.query(`
      SELECT xso.ITEM_CODE, xso.STOCK_QUANTITY, xso.UNIT_PRICE, xso.\`A/C_UNIT\` AS ac_unit,
             xso.PEGS, xi.CATEGORY_ID, xi.ITEM_NAME, xi.SUB_CATEGORY,
             xi.PROFIT, xi.NON_MEMBER_PROFIT, xi.PR_CHARGES, xi.FOOD_PR_CHARGES
      FROM xxafmc_stock_out xso
      LEFT JOIN xxafmc_inventory xi ON xso.ITEM_CODE = xi.ITEM_CODE
      WHERE xso.BARCODE = ? LIMIT 1`, [BARCODE]);

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
    if (KITCHEN === "Bar" && categoryId === 14) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: "Scanned Barcode is for Kitchen" });
    }
    if (KITCHEN === "Kitchen" && categoryId === 10) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: "Scanned Barcode is for Bar" });
    }

    if (stockQuantity <= 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: `Scanned Barcode ${BARCODE} has no stock` });
    }

    // Get parent item
    const [parentRows] = await connection.query(`
      SELECT inventory_item_code FROM (
        SELECT inventory_item_code FROM xxafmc_custom_cocktails_mocktails_details WHERE order_number = ? AND item_code = ?
        UNION ALL
        SELECT inventory_item_code FROM xxafmc_custom_cocktails_mocktails_details_dummy WHERE order_number = ? AND item_code = ?
        UNION ALL
        SELECT CAST(item_id AS CHAR) FROM xxafmc_order_details WHERE order_id = ? AND item_id = ?
      ) x LIMIT 1`,
      [ORDERNUMBER, scanItemCode, ORDERNUMBER, scanItemCode, ORDERNUMBER, scanItemCode]);

    const parentItem = parentRows.length > 0 ? parentRows[0].inventory_item_code : String(scanItemCode);

    // Get role
    const [userRows] = await connection.query(
      `SELECT DISTINCT xu.ROLE_ID FROM xxafmc_users xu JOIN xxafmc_kitchen_notification xkn ON xu.USER_ID = xkn.USER_NAME 
       WHERE xkn.ORDERNUMBER = ? LIMIT 1`, [ORDERNUMBER]);
    const roleId = userRows.length > 0 ? Number(userRows[0].ROLE_ID) : null;

    // Get ordered quantity (l_ord_qty_item)
    const [orderQtyRows] = await connection.query(`
      SELECT SUM(quantity) AS total_quantity FROM (
        SELECT (x.pegs * x.quantity) AS quantity FROM xxafmc_custom_cocktails_mocktails_details x 
        JOIN xxafmc_order_details xo ON x.inventory_item_code = xo.item_id 
        WHERE x.order_number = ? AND x.item_code = ?
        UNION ALL
        SELECT (x.pegs * x.quantity) AS quantity FROM xxafmc_custom_cocktails_mocktails_details_dummy x 
        JOIN xxafmc_order_details xo ON x.inventory_item_code = xo.item_id 
        WHERE x.order_number = ? AND x.item_code = ?
        UNION ALL
        SELECT (CASE WHEN xo.type = 'Large' THEN 2 ELSE 1 END * xo.quantity) AS quantity 
        FROM xxafmc_order_details xo JOIN xxafmc_inventory xi ON xi.item_code = xo.item_id 
        WHERE xo.order_id = ? AND xi.unit_price IS NOT NULL AND xi.item_code = ?
      ) a`,
      [ORDERNUMBER, scanItemCode, ORDERNUMBER, scanItemCode, ORDERNUMBER, scanItemCode]);

    const orderedQty = Number(orderQtyRows[0]?.total_quantity || 0);

    if (orderedQty <= 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: `Scanned item does not belong to order ${ORDERNUMBER}` });
    }

    // === Collection metrics (like apex_collections) ===
    const scannedCollection = req.session[sessionKey] || [];

    const l_scan_item_qty = scannedCollection
      .filter(s => Number(s.itemCode) === Number(scanItemCode))
      .reduce((sum, s) => sum + Number(s.scanQuantity || 0), 0);

    const l_total_scanned_qty = scannedCollection
      .filter(s => Number(s.itemCode) === Number(scanItemCode) &&
        s.barcode === BARCODE &&
        Number(s.parentItem) === Number(parentItem))
      .reduce((sum, s) => sum + Number(s.scanQuantity || 0), 0);

    const l_barcode_scanned_qty = scannedCollection.filter(s => s.barcode === BARCODE).length;

    // === Exact ac_unit validation from Oracle package ===
    if (['Nos', 'Can', 'glass'].includes(acUnit)) {
      if (l_barcode_scanned_qty >= 1) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: `Error: Duplicate bottle scan for ${BARCODE}` });
      }
      if (requestedQty > stockQuantity) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: `Error: Entered quantity is more than the stock ${BARCODE}` });
      }
      if (orderedQty < l_scan_item_qty + requestedQty) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'Error: Scanned Qty is morethan Order quantity' });
      }
    } else {
      if (l_total_scanned_qty + requestedQty > stockQuantity) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: `Error: Scanned Qty is morethen stock for barcode ${BARCODE}` });
      }
      if (orderedQty < l_scan_item_qty + requestedQty) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'Error: Scanned Qty is morethan Order quantity' });
      }
    }


    // ================= PRICE CALCULATION (FINAL - ORACLE MATCH) =================

    // STEP A: Get sub_category from order_details (important)
    let subCategory = null;
    const [subCategoryRows] = await connection.query(
      `
  SELECT subcategory
  FROM xxafmc_order_details
  WHERE item_id = ? AND order_id = ?
  LIMIT 1
  `,
      [scanItemCode, ORDERNUMBER]
    );

    subCategory = subCategoryRows.length > 0
      ? Number(subCategoryRows[0].subcategory)
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
    const profitPercent = Number(item.PROFIT) || 0;
    const nonMemberProfit = Number(item.NON_MEMBER_PROFIT) || 0;
    const prCharges = Number(item.PR_CHARGES) || 0;
    const foodPrCharges = Number(item.FOOD_PR_CHARGES) || 0;
    const pegsFromStock = Number(item.PEGS) || 1;


    // STEP D: Calculate price
    let calculatedPrice = unitPrice;
    let isFree = false;

    if (isFreeItem && Number(scanItemCode) === Number(freeItemRows[0].item_id)) {

      // ✅ FREE ITEM
      calculatedPrice = 0;
      isFree = true;

      await connection.query(
        `
    UPDATE xxafmc_order_details
    SET free_item_quantity = '1'
    WHERE order_id = ? 
      AND item_id = ? 
      AND barcode IS NOT NULL
    `,
        [ORDERNUMBER, scanItemCode]
      );

    } else {

      const pricePerPeg = pegsFromStock > 0
        ? unitPrice / pegsFromStock
        : unitPrice;

      // ✅ SAME logic for both (you had duplicate branches → simplified)
      if (roleId === 20) {
        const profit =
          pricePerPeg +
          (pricePerPeg * profitPercent / 100) +
          foodPrCharges;

        calculatedPrice = Number(profit).toFixed(2);

      } else {
        const profit =
          pricePerPeg +
          (pricePerPeg * nonMemberProfit / 100) +
          prCharges;

        calculatedPrice = Number(profit).toFixed(2);
      }
    }

    await connection.commit();

    const [componentRows] = await connection.query(`
      SELECT item_code, item_name, quantity AS total_quantity, inventory_item_code, Mix
      FROM (
        SELECT DISTINCT x.item_code, x.item_name, (x.pegs*x.quantity) AS quantity, x.inventory_item_code, 'MO' AS Mix
        FROM xxafmc_custom_cocktails_mocktails_details x JOIN xxafmc_order_details xo ON x.inventory_item_code = xo.item_id
        WHERE x.order_number = ? AND x.item_code = ?
        UNION ALL
        SELECT DISTINCT x.item_code, x.item_name, (x.pegs*x.quantity) AS quantity, x.inventory_item_code, 'MO' AS Mix
        FROM xxafmc_custom_cocktails_mocktails_details_dummy x JOIN xxafmc_order_details xo ON x.inventory_item_code = xo.item_id
        WHERE x.order_number = ? AND x.item_code = ?
        UNION ALL
        SELECT xi.item_code, xi.item_name, (CASE WHEN xo.type='Large' THEN 2 ELSE 1 END * xo.quantity) AS quantity,
               CAST(xo.ITEM_ID AS CHAR) AS inventory_item_code, 'I' AS Mix
        FROM xxafmc_order_details xo JOIN xxafmc_inventory xi ON xi.item_code = xo.ITEM_ID
        WHERE xo.order_id = ? AND xi.UNIT_PRICE IS NOT NULL AND xi.item_code = ?
      ) A`,
      [ORDERNUMBER, scanItemCode, ORDERNUMBER, scanItemCode, ORDERNUMBER, scanItemCode]);

    const currentScanned = req.session[sessionKey] || [];

    let componentsWithRemaining = componentRows
      .map(comp => {
        const already = currentScanned
          .filter(s => Number(s.itemCode) === Number(comp.item_code) &&
            Number(s.parentItem || s.itemCode) === Number(comp.inventory_item_code))
          .reduce((sum, s) => sum + Number(s.scanQuantity || 0), 0);
        return { ...comp, coll_qty: Math.max(0, Number(comp.total_quantity) - already) };
      })
      .filter(comp => comp.coll_qty > 0)
      .sort((a, b) => a.Mix.localeCompare(b.Mix));

    // CRITICAL: If nothing left to add → show exact Oracle error
    if (componentsWithRemaining.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Error: Scanned Qty is morethan Order quantity'
      });
    }

    // Add to session (Oracle loop logic)
    let reqQtyLeft = requestedQty;
    const addedThisScan = [];

    for (const comp of componentsWithRemaining) {
      if (reqQtyLeft <= 0) break;
      const qtyToAdd = Math.min(reqQtyLeft, comp.coll_qty);

      const newEntry = {
        id: Date.now() + addedThisScan.length,
        itemCode: comp.item_code,
        itemName: comp.item_name,
        scanQuantity: qtyToAdd,
        itemPrice: calculatedPrice,
        barcode: BARCODE,
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

    // Final Response - Only success if we actually added something
    return res.status(201).json({
      success: true,
      message: "Barcode scanned successfully",
      data: {
        itemCode: scanItemCode,
        itemName: item.ITEM_NAME,
        calculatedPrice,
        barcode: BARCODE,
        addedThisScan
      }
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Barcode scan error:", error);
    return res.status(500).json({ success: false, message: "Failed to process scan" });
  } finally {
    if (connection) connection.release();
  }
};

exports.getScannedItemsFromSession = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const sessionKey = `scannedItems_${orderNumber}_${req.user?.username || 'unknown'}`;
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
    const sessionKey = `scannedItems_${orderNumber}_${req.user?.username || 'unknown'}`;
    delete req.session[sessionKey];

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

exports.cancelBarOrderItem = async (req, res) => {
  try {
    const { ORDER_LINE_ID } = req.body;

    if (!ORDER_LINE_ID) {
      return res.status(400).json({
        success: false,
        message: "Order line ID is required",
      });
    }

    const [updateResult] = await pool.query(
      `UPDATE xxafmc_order_details SET ORDER_STATUS = 'CANCELLED' WHERE ORDER_LINE_ID = ?`,
      [ORDER_LINE_ID]
    );

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Order item not found",
      });
    }

    await pool.query(
      `UPDATE xxafmc_kitchen_notification kn
       SET kn.status = 'Cancelled'
       WHERE EXISTS (
         SELECT 1 FROM xxafmc_order_details od
         WHERE od.order_line_id = ? AND od.order_id = kn.ordernumber AND od.item_id = kn.item_id
       )`,
      [ORDER_LINE_ID]
    );

    return res.status(200).json({
      success: true,
      message: "Order item cancelled successfully",
    });
  } catch (error) {
    console.error("Error cancelling bar order item:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to cancel order item",
      error: error.message,
    });
  }
};


exports.getActiveBarOrders = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM xxafmc_kitchen_notification WHERE MSG_READ = 'N'`
    );
    // console.log("Active bar orders:", rows.length);
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
        XCMD.QUANTITY
      FROM xxafmc_order_details XOD
      JOIN xxafmc_custom_cocktails_mocktails_details XCMD ON XOD.ITEM_ID = XCMD.INVENTORY_ITEM_CODE
      WHERE XCMD.ORDER_NUMBER = ?
        AND XCMD.INVENTORY_ITEM_CODE = ?
      
      UNION
      
      SELECT DISTINCT 
        XCMD.ITEM_NAME,
        XCMD.ITEM_CODE,
        XCMD.PEGS,
        XCMD.QUANTITY
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
      [orderNumber, itemId, orderNumber, itemId, orderNumber]
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
  let connection;

  try {
    let { fromDate, toDate } = req.query;

    // console.log("Fetching cancelled orders from", fromDate, "to", toDate);

    // ✅ Normalize input dates (important)
    const normalizeDate = (date) => {
      if (!date) return null;
      const d = new Date(date);
      return isNaN(d) ? null : d.toISOString().slice(0, 10); // YYYY-MM-DD
    };

    const from = normalizeDate(fromDate);
    const to = normalizeDate(toDate);


    const query = `
      SELECT 
          xxkn.order_num,
          xxkn.order_date,
          COALESCE(xnm.first_name, xu.first_name) AS first_name,
          CONCAT(
            UPPER(LEFT(xp.pubmed_name, 1)),
            LOWER(SUBSTRING(xp.pubmed_name, 2))
          ) AS pubmed_name
      FROM xxafmc_order_header xxkn
      LEFT JOIN xxafmc_non_members xnm 
          ON xnm.id = xxkn.member_id
      LEFT JOIN xxafmc_users xu 
          ON xu.user_id = xxkn.user_id
      JOIN xxafmc_pubmed xp 
          ON xp.pubmed_id = xxkn.pubmed
      WHERE EXISTS (
          SELECT 1
          FROM xxafmc_order_details xod
          WHERE xod.order_id = xxkn.order_num
          GROUP BY xod.order_id
          HAVING COUNT(*) = COUNT(
              CASE WHEN UPPER(xod.order_status) = 'CANCELLED' THEN 1 END
          )
      )
      AND (
        CASE 
          WHEN xxkn.order_date LIKE '%/%' 
            THEN STR_TO_DATE(xxkn.order_date, '%m/%d/%Y')
          ELSE xxkn.order_date
        END
      ) BETWEEN COALESCE(?, CURDATE()) AND COALESCE(?, CURDATE())
      ORDER BY xxkn.order_num DESC
    `;

    const [rows] = await pool.execute(query, [
      from || null,
      to || null
    ]);

    // console.log("Cancelled orders fetched:", rows);

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

  } finally {
    if (connection) await connection.close();
  }
};

exports.getOrderHistory = async (req, res) => {
  try {
    const { fromDate, toDate, page = 1, limit = 10 } = req.query;
    // console.log("Fetching order history with params:", { fromDate, toDate, page, limit });
    const normalizeDate = (date) => {
      if (!date) return null;
      const d = new Date(date);
      return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
    };

    let from = normalizeDate(fromDate);
    let to = normalizeDate(toDate);

    if (!from) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      from = thirtyDaysAgo.toISOString().slice(0, 10);
    }
    if (!to) to = new Date().toISOString().slice(0, 10);

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const query = `
    SELECT 
  kn.ordernumber AS order_num,
  nm.order_date,

  COALESCE(xnm.first_name, xu.first_name) AS first_name,
  COALESCE(xnm.phone_number, xu.phone_number) AS phone_number,

  CONCAT(UPPER(LEFT(xp.pubmed_name, 1)), LOWER(SUBSTRING(xp.pubmed_name, 2))) AS pubmed_name,

  CASE
    WHEN SUM(CASE WHEN UPPER(kn.status) = 'PREPARING' THEN 1 ELSE 0 END) > 0
         AND SUM(CASE WHEN UPPER(kn.status) = 'COMPLETED' THEN 1 ELSE 0 END) > 0
    THEN 'PARTIALLY COMPLETED'

    WHEN SUM(CASE WHEN UPPER(kn.status) = 'RECEIVED' THEN 1 ELSE 0 END) > 0
         AND SUM(CASE WHEN UPPER(kn.status) = 'COMPLETED' THEN 1 ELSE 0 END) > 0
    THEN 'PARTIALLY COMPLETED'

    WHEN SUM(CASE WHEN UPPER(kn.status) IN ('COMPLETED','CANCELLED') THEN 1 ELSE 0 END) = COUNT(*)
    THEN 'COMPLETED'

    WHEN SUM(CASE WHEN UPPER(kn.status) = 'CANCELLED' THEN 1 ELSE 0 END) = COUNT(*)
    THEN 'CANCELLED'

    ELSE 'PREPARING'
  END AS status

FROM xxafmc_kitchen_notification kn

LEFT JOIN xxafmc_order_header nm 
  ON nm.order_num = kn.ordernumber

LEFT JOIN xxafmc_non_members xnm 
  ON xnm.id = nm.member_id

LEFT JOIN xxafmc_users xu 
  ON xu.user_id = nm.user_id

JOIN xxafmc_pubmed xp 
  ON xp.pubmed_id = nm.pubmed

WHERE STR_TO_DATE(nm.order_date, '%m/%d/%Y') 
      BETWEEN STR_TO_DATE(?, '%Y-%m-%d') 
      AND STR_TO_DATE(?, '%Y-%m-%d')

GROUP BY kn.ordernumber, nm.order_date, first_name, phone_number, xp.pubmed_name

-- ✅ APEX HAVING (IMPORTANT)
HAVING 
  SUM(CASE WHEN UPPER(kn.status) IN ('PREPARING','CANCELLED','RECEIVED') THEN 1 ELSE 0 END) < COUNT(*)

ORDER BY kn.ordernumber DESC
LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(DISTINCT nm.order_num) as total
      FROM xxafmc_order_header nm
      WHERE STR_TO_DATE(nm.order_date, '%m/%d/%Y') 
            BETWEEN STR_TO_DATE(?, '%Y-%m-%d') 
            AND STR_TO_DATE(?, '%Y-%m-%d')
    `;

    const dateParams = [from, to];

    const [countResult] = await pool.execute(countQuery, dateParams);
    const totalRecords = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalRecords / limitNum);

    // Critical fix for MySQL 8.0.22+ bug
    const queryParams = [from, to, String(limitNum), String(offset)];

    const [rows] = await pool.execute(query, queryParams);
    // console.log(rows);

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
    console.log("Fetching item details for order:", orderNumber);
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
        COALESCE(xo.type, 'NA') AS type,
        xi.item_name,
        xo.quantity,

        xo.subtotal,
        xo.price,
        IFNULL(xo.food_pr_charges, 0) AS pr_charges,

        xo.created_by,
        xo.creation_date,
        xo.last_updated_date,
        xo.last_updated_by,

        -- ✅ item-level status (avoid duplicates)
        MAX(xxkn.status) AS status

      FROM xxafmc_order_details xo

      JOIN xxafmc_inventory xi 
        ON xo.item_id = xi.item_code

      JOIN xxafmc_order_header xoh 
        ON xo.order_id = xoh.order_num

      JOIN xxafmc_users xu 
        ON xoh.user_id = xu.user_id

      JOIN xxafmc_role r 
        ON xu.role_id = r.role_id

      -- ✅ critical join (same as APEX)
      JOIN xxafmc_kitchen_notification xxkn 
        ON xxkn.ordernumber = xo.order_id
       AND xxkn.item_id = xo.item_id

      WHERE xo.order_id = ?

      GROUP BY 
        xo.order_line_id,
        xo.order_id,
        xo.item_id,
        xo.type,
        xi.item_name,
        xo.quantity,
        xo.subtotal,
        xo.price,
        xo.food_pr_charges,
        xo.created_by,
        xo.creation_date,
        xo.last_updated_date,
        xo.last_updated_by
    `;

    // 🔹 Total query
    const totalQuery = `
      SELECT 
        SUM(xo.subtotal) AS total_amount
      FROM xxafmc_order_details xo
      JOIN xxafmc_kitchen_notification xxkn 
        ON xxkn.ordernumber = xo.order_id
       AND xxkn.item_id = xo.item_id
      WHERE xo.order_id = ?
    `;

    const [items] = await pool.execute(itemsQuery, [orderNumber]);
    const [totalResult] = await pool.execute(totalQuery, [orderNumber]);

    const totalAmount = totalResult[0]?.total_amount || 0;
    console.log(`Fetched ${items.length} items for order ${orderNumber} with total amount ${totalAmount}`);
    res.json({
      success: true,
      data: {
        orderNumber,
        items,
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
        xkn.item_name,
        xkn.status AS item_kitchen_status,
        xod.quantity,
        COALESCE(xod.type, 'NA') AS type,
        xod.order_status AS status,
        xkn.status AS kitchen_status
      FROM xxafmc_order_details xod
      LEFT JOIN xxafmc_kitchen_notification xkn 
        ON xod.order_id = xkn.ordernumber 
        AND xod.item_id = xkn.item_id
      WHERE xod.order_id = ?
      AND TRIM(UPPER(xod.order_status)) = 'CANCELLED'
    `;

    const [rows] = await connection.execute(sql, [orderNumber]);


    res.json({
      success: true,
      count: rows.length,
      data: rows
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
