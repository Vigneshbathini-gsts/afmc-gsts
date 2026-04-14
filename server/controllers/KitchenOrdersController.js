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
      [result] = await pool.query(
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
    console.error("Error updating bar order status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update order status",
      error: error.message,
    });
  }
};

exports.getOrderItems = async (req, res) => {
  try {
    const { ORDERNUMBER, KITCHEN } = req.body;

    if (!ORDERNUMBER) {
      return res.status(400).json({
        success: false,
        message: "ORDERNUMBER is required",
      });
    }

    let categoryFilter = "";
    let params = [ORDERNUMBER];

    // Category filter
    if (KITCHEN === "Bar") {
      categoryFilter = "AND xi.CATEGORY_ID = 10";
    } else if (KITCHEN === "Kitchen") {
      categoryFilter = "AND xi.CATEGORY_ID = 14";
    }

   const query = `
 SELECT 
  xod.ORDER_LINE_ID,
  xod.ITEM_ID,
  xod.QUANTITY,
  xi.ITEM_NAME,
  COALESCE(xod.TYPE, 'NA') AS TYPE,

  CASE 
    WHEN xi.SUB_CATEGORY IN (14,15) THEN 'Y'
    ELSE 'N'
  END AS LINK_ENABLED,

  'Y' AS CAN_CANCEL

FROM xxafmc_order_details xod

JOIN (
  SELECT DISTINCT ITEM_CODE, ITEM_NAME, SUB_CATEGORY, CATEGORY_ID
  FROM xxafmc_inventory
) xi
  ON xod.ITEM_ID = xi.ITEM_CODE

WHERE xod.ORDER_ID = ?
  AND COALESCE(xod.ORDER_STATUS, '') = ''
  ${categoryFilter}

ORDER BY xod.ORDER_LINE_ID ASC;
`;

    const [rows] = await pool.query(query, params);

    const formattedData = rows.map((row) => ({
      ORDER_LINE_ID: row.ORDER_LINE_ID,
      ITEM_ID: row.ITEM_ID,
      quantity: row.QUANTITY,
      ITEM_NAME: row.ITEM_NAME,
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

    console.log("========== BARCODE SCAN START ==========");
    console.log("Request body:", { ORDERNUMBER, BARCODE, QUANTITY, KITCHEN });

    if (!ORDERNUMBER || !BARCODE) {
      return res.status(400).json({
        success: false,
        message: "Order number and barcode are required",
      });
    }

    const requestedQty = Number(QUANTITY) || 1;
    
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // STEP 1: Get item from stock_out and inventory
    const [itemRows] = await connection.query(
      `
      SELECT 
        xso.ITEM_CODE,
        xso.STOCK_QUANTITY,
        xso.UNIT_PRICE,
        xso.\`A/C_UNIT\` AS ac_unit,
        xso.PEGS,
        xso.BARCODE,
        xi.CATEGORY_ID,
        xi.ITEM_NAME,
        xi.SUB_CATEGORY,
        xi.PROFIT,
        xi.NON_MEMBER_PROFIT,
        xi.PR_CHARGES,
        xi.FOOD_PR_CHARGES
      FROM xxafmc_stock_out xso
      LEFT JOIN xxafmc_inventory xi ON xso.ITEM_CODE = xi.ITEM_CODE
      WHERE xso.BARCODE = ?
      LIMIT 1
      `,
      [BARCODE]
    );
    
    if (itemRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Barcode not found in inventory",
      });
    }

    const item = itemRows[0];
    const categoryId = Number(item.CATEGORY_ID) || 0;
    const scanItemCode = item.ITEM_CODE;

    // STEP 2: Validate Kitchen/Bar match (from Oracle package)
    if (KITCHEN === "Bar" && categoryId === 14) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Scanned Barcode is for Kitchen",
      });
    }

    if (KITCHEN === "Kitchen" && categoryId === 10) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Scanned Barcode is for Bar",
      });
    }

    const stockQuantity = Number(item.STOCK_QUANTITY) || 0;
    const unitPrice = Number(item.UNIT_PRICE) || 0;
    const profitPercent = Number(item.PROFIT) || 0;
    const nonMemberProfit = Number(item.NON_MEMBER_PROFIT) || 0;
    const prCharges = Number(item.PR_CHARGES) || 0;
    const foodPrCharges = Number(item.FOOD_PR_CHARGES) || 0;
    const pegsFromStock = Number(item.PEGS) || 1;
    const acUnit = (item.ac_unit || "").toString();

    // STEP 3: Check stock
    if (stockQuantity <= 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Scanned Barcode ${BARCODE} has no stock in ${KITCHEN}`,
      });
    }

    // STEP 4: Find parent item (like Oracle's SELECT with UNION)
    const [parentRows] = await connection.query(
      `
      SELECT inventory_item_code, 'cocktail' AS source_type
      FROM (
        SELECT inventory_item_code
        FROM xxafmc_custom_cocktails_mocktails_details
        WHERE order_number = ? AND item_code = ?
        UNION ALL
        SELECT inventory_item_code
        FROM xxafmc_custom_cocktails_mocktails_details_dummy
        WHERE order_number = ? AND item_code = ?
        UNION ALL
        SELECT CAST(item_id AS CHAR)
        FROM xxafmc_order_details
        WHERE order_id = ? AND item_id = ?
      ) x
      LIMIT 1
      `,
      [ORDERNUMBER, scanItemCode, ORDERNUMBER, scanItemCode, ORDERNUMBER, scanItemCode]
    );

    const parentItem = parentRows.length > 0 ? parentRows[0].inventory_item_code : String(scanItemCode);
    const isCocktailIngredient = parentRows.length > 0 && parentRows[0].source_type === 'cocktail';

    // STEP 5: Get user role (like Oracle)
    const [userRows] = await connection.query(
      `SELECT DISTINCT xu.ROLE_ID FROM xxafmc_users xu
       JOIN xxafmc_kitchen_notification xkn ON xu.USER_ID = xkn.USER_NAME
       WHERE xkn.ORDERNUMBER = ? LIMIT 1`,
      [ORDERNUMBER]
    );
    const roleId = userRows.length > 0 ? Number(userRows[0].ROLE_ID) : null;

    // STEP 6: Get ordered quantity (like Oracle's cursor)
    const [orderQuantityRows] = await connection.query(
      `
      SELECT SUM(quantity) AS total_quantity
      FROM (
        SELECT DISTINCT x.item_code, (x.pegs * x.quantity) AS quantity
        FROM xxafmc_custom_cocktails_mocktails_details x
        JOIN xxafmc_order_details xo ON x.inventory_item_code = xo.item_id
        WHERE x.order_number = ? AND x.item_code = ?
        UNION ALL
        SELECT DISTINCT x.item_code, (x.pegs * x.quantity) AS quantity
        FROM xxafmc_custom_cocktails_mocktails_details_dummy x
        JOIN xxafmc_order_details xo ON x.inventory_item_code = xo.item_id
        WHERE x.order_number = ? AND x.item_code = ?
        UNION ALL
        SELECT xi.item_code, (CASE WHEN xo.type = 'Large' THEN 2 ELSE 1 END * xo.quantity) AS quantity
        FROM xxafmc_order_details xo
        JOIN xxafmc_inventory xi ON xi.item_code = xo.item_id
        WHERE xo.order_id = ? AND xi.unit_price IS NOT NULL AND xi.item_code = ?
      ) a
      `,
      [ORDERNUMBER, scanItemCode, ORDERNUMBER, scanItemCode, ORDERNUMBER, scanItemCode]
    );

    const orderedQty = Number(orderQuantityRows[0]?.total_quantity || 0);

    // STEP 7: Get sub_category for price calculation (like Oracle)
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
    subCategory = subCategoryRows.length > 0 ? Number(subCategoryRows[0].subcategory) : null;

    // STEP 8: Check for free item (like Oracle)
    const [freeItemRows] = await connection.query(
      `
      SELECT item_id, price
      FROM xxafmc_order_details
      WHERE order_id = ? AND item_id = ? AND barcode IS NOT NULL AND free_item_quantity IS NULL
      LIMIT 1
      `,
      [ORDERNUMBER, scanItemCode]
    );

    const isFreeItem = freeItemRows.length > 0 && Number(freeItemRows[0].price) === 0;

    // STEP 9: Calculate price (like Oracle)
    let calculatedPrice = unitPrice;
    let isFree = false;

    if (isFreeItem && Number(scanItemCode) === Number(freeItemRows[0].item_id)) {
      calculatedPrice = 0;
      isFree = true;
      await connection.query(
        `
        UPDATE xxafmc_order_details
        SET free_item_quantity = '1'
        WHERE order_id = ? AND item_id = ? AND barcode IS NOT NULL
        `,
        [ORDERNUMBER, scanItemCode]
      );
    } else {
      const pricePerPeg = pegsFromStock > 0 ? unitPrice / pegsFromStock : unitPrice;
      
      if (subCategory && [14, 15].includes(subCategory)) {
        // Cocktail/Mocktail price calculation
        if (roleId === 20) {
          const profit = pricePerPeg + (pricePerPeg * profitPercent / 100) + foodPrCharges;
          calculatedPrice = Number(profit).toFixed(2);
        } else {
          const profit = pricePerPeg + (pricePerPeg * nonMemberProfit / 100) + prCharges;
          calculatedPrice = Number(profit).toFixed(2);
        }
      } else {
        // Regular item price calculation
        if (roleId === 20) {
          const profit = pricePerPeg + (pricePerPeg * profitPercent / 100) + foodPrCharges;
          calculatedPrice = Number(profit).toFixed(2);
        } else {
          const profit = pricePerPeg + (pricePerPeg * nonMemberProfit / 100) + prCharges;
          calculatedPrice = Number(profit).toFixed(2);
        }
      }
    }

    // STEP 10: Get cocktail ingredients (like Oracle's cursor c_ord_dt)
    let ingredientsToInsert = [];
    
    if (isCocktailIngredient) {
      const [ingredients] = await connection.query(
        `
        SELECT 
          item_code,
          item_name,
          (pegs * quantity) AS total_quantity,
          inventory_item_code
        FROM xxafmc_custom_cocktails_mocktails_details
        WHERE order_number = ? AND inventory_item_code = ?
        UNION ALL
        SELECT 
          item_code,
          item_name,
          (pegs * quantity) AS total_quantity,
          inventory_item_code
        FROM xxafmc_custom_cocktails_mocktails_details_dummy
        WHERE order_number = ? AND inventory_item_code = ?
        `,
        [ORDERNUMBER, parentItem, ORDERNUMBER, parentItem]
      );
      ingredientsToInsert = ingredients;
    }

    await connection.commit();

    // STEP 11: Return complete data (frontend will handle state)
    return res.status(201).json({
      success: true,
      message: "Barcode scanned successfully",
      data: {
        itemCode: scanItemCode,
        itemName: item.ITEM_NAME,
        categoryId: categoryId,
        subCategory: subCategory,
        stockQuantity: stockQuantity,
        unitPrice: unitPrice,
        calculatedPrice: calculatedPrice,
        orderedQuantity: orderedQty,
        requestedQuantity: requestedQty,
        barcode: BARCODE,
        remainingToScan: orderedQty > 0 ? orderedQty : 0,
        isFreeItem: isFree,
        isCocktailIngredient: isCocktailIngredient,
        ingredients: ingredientsToInsert,
        parentItem: parentItem,
        pegs: pegsFromStock,
        roleId: roleId,
        acUnit: acUnit
      },
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error processing barcode scan:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process barcode scan",
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};


exports.cancelOrder = async (req, res) => {
  let connection;
  
  try {
    const { ORDERNUMBER } = req.body;
    
    // Enhanced validation
    if (!ORDERNUMBER) {
      return res.status(400).json({
        success: false,
        message: "Order number is required to cancel an order",
      });
    }

    // Convert to number if needed
    const orderNumber = parseInt(ORDERNUMBER);
    if (isNaN(orderNumber)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order number format",
      });
    }

    // Get database connection for transaction
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Step 1: Check if order exists and can be cancelled
    const [orderCheck] = await connection.query(
      `SELECT 
        COUNT(*) as total_count,
        SUM(CASE WHEN status IN ('Received', 'Preparing') THEN 1 ELSE 0 END) as cancellable_count,
        SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completed_count
       FROM xxafmc_kitchen_notification 
       WHERE ordernumber = ?`,
      [orderNumber]
    );

    if (orderCheck[0].total_count === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: `Order ${orderNumber} not found`,
      });
    }

    // Check if order can be cancelled (has any items in Received/Preparing status)
    if (orderCheck[0].cancellable_count === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: orderCheck[0].completed_count > 0 
          ? `Order ${orderNumber} has completed items and cannot be cancelled` 
          : `Order ${orderNumber} cannot be cancelled`,
      });
    }

    // Step 2: Update kitchen notifications
    const [notificationUpdate] = await connection.query(
      `UPDATE xxafmc_kitchen_notification
       SET status = 'Cancelled',
           updated_at = NOW()
       WHERE ordernumber = ?
         AND status IN ('Received', 'Preparing')`,
      [orderNumber]
    );

    // Step 3: Update order details (line items)
    const [orderDetailsUpdate] = await connection.query(
      `UPDATE xxafmc_order_details
       SET ORDER_STATUS = 'CANCELLED',
           CANCELLED_DATE = NOW(),
           CANCELLED_BY = ?
       WHERE ORDER_ID = ? 
         AND COALESCE(ORDER_STATUS, '') = ''
         AND ORDER_STATUS != 'CANCELLED'`,
      [req.user?.user_name || req.user?.username || 'SYSTEM', orderNumber]
    );

    // Step 4: Update order header if exists
    const [headerUpdate] = await connection.query(
      `UPDATE xxafmc_order_header
       SET ORDER_STATUS = 'CANCELLED',
           CANCELLED_DATE = NOW(),
           CANCELLED_BY = ?
       WHERE ORDER_NUM = ?
         AND ORDER_STATUS != 'COMPLETED'`,
      [req.user?.user_name || req.user?.username || 'SYSTEM', orderNumber]
    );

    // Step 5: Log cancellation for audit trail (optional but recommended)
    await connection.query(
      `INSERT INTO xxafmc_order_audit_log 
       (order_number, action, action_by, action_date, details)
       VALUES (?, 'CANCELLED', ?, NOW(), ?)`,
      [
        orderNumber, 
        req.user?.user_name || req.user?.username || 'SYSTEM',
        JSON.stringify({
          notifications_cancelled: notificationUpdate.affectedRows,
          items_cancelled: orderDetailsUpdate.affectedRows,
          timestamp: new Date().toISOString()
        })
      ]
    );

    // Commit transaction
    await connection.commit();

    // Return success response with details
    return res.status(200).json({
      success: true,
      message: `Order ${orderNumber} cancelled successfully`,
      data: {
        orderNumber: orderNumber,
        notificationsCancelled: notificationUpdate.affectedRows,
        itemsCancelled: orderDetailsUpdate.affectedRows,
        cancelledBy: req.user?.user_name || req.user?.username || 'SYSTEM',
        cancelledAt: new Date().toISOString()
      }
    });

  } catch (error) {
    // Rollback transaction on error
    if (connection) {
      await connection.rollback();
    }
    
    console.error("Error cancelling order:", error);
    
    // Handle specific database errors
    if (error.code === 'ER_LOCK_DEADLOCK') {
      return res.status(409).json({
        success: false,
        message: "Order is currently being processed. Please try again.",
        error: "DEADLOCK"
      });
    }
    
    return res.status(500).json({
      success: false,
      message: "Failed to cancel order due to system error",
      error: process.env.NODE_ENV === 'development' ? error.message : "Internal server error",
    });
  } finally {
    // Release connection back to pool
    if (connection) {
      connection.release();
    }
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

    // 🔍 Step 1: Get current item details
    const [rows] = await pool.query(
      `SELECT ORDER_ID, ITEM_ID, ORDER_STATUS 
       FROM xxafmc_order_details 
       WHERE ORDER_LINE_ID = ?`,
      [ORDER_LINE_ID]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Order item not found",
      });
    }

    const item = rows[0];

    // ❌ Step 2: Prevent invalid cancel
    if (item.ORDER_STATUS && item.ORDER_STATUS !== '') {
      return res.status(400).json({
        success: false,
        message: "Item already processed or cancelled",
      });
    }

    // ✅ Step 3: Cancel item safely
    const [updateResult] = await pool.query(
      `UPDATE xxafmc_order_details 
       SET ORDER_STATUS = 'CANCELLED'
       WHERE ORDER_LINE_ID = ?
         AND COALESCE(ORDER_STATUS, '') = ''`,
      [ORDER_LINE_ID]
    );

    if (updateResult.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        message: "Item already cancelled or processed",
      });
    }

    // ✅ Step 4: Update kitchen notification
    await pool.query(
      `UPDATE xxafmc_kitchen_notification
       SET status = 'Cancelled'
       WHERE ordernumber = ?
         AND item_id = ?`,
      [item.ORDER_ID, item.ITEM_ID]
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
