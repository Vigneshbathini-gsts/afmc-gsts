const { Console } = require("winston/lib/winston/transports");
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
    const { ORDERNUMBER, KITCHEN = "Bar" } = req.body;
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

    const [result] = await pool.query(
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

    return res.status(200).json({
      success: true,
      message: result.affectedRows > 0
        ? "Order status updated to Preparing"
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

    // ✅ optional filter (not strict)
    let categoryFilter = "";
    let params = [ORDERNUMBER];

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
  xi.SUB_CATEGORY,
  xod.ORDER_STATUS,

  CASE 
    WHEN xi.SUB_CATEGORY IN (14,15) THEN 'Y'
    ELSE 'N'
  END AS LINK_ENABLED,

  CASE 
    WHEN xi.SUB_CATEGORY IN (14,15) 
         AND (xod.ORDER_STATUS IS NULL OR xod.ORDER_STATUS = '')
    THEN 'Y'
    ELSE 'N'
  END AS CAN_CANCEL

FROM xxafmc_order_details xod

JOIN (
  SELECT DISTINCT ITEM_CODE, ITEM_NAME, SUB_CATEGORY, CATEGORY_ID
  FROM xxafmc_inventory
) xi 
  ON xod.ITEM_ID = xi.ITEM_CODE

WHERE xod.ORDER_ID = ?
AND (xod.ORDER_STATUS IS NULL OR xod.ORDER_STATUS = '')
${categoryFilter}

ORDER BY xod.ORDER_LINE_ID ASC;
    `;

    const [rows] = await pool.query(query, params);

    // console.log(`Fetched ${rows.length} rows for ${KITCHEN}`);

    const formattedData = rows.map((row) => ({
      ORDER_LINE_ID: row.ORDER_LINE_ID,
      ITEM_ID: row.ITEM_ID,
      quantity: row.QUANTITY,
      ITEM_NAME: row.ITEM_NAME,
      TYPE: row.TYPE,
      LINK_ENABLED: row.LINK_ENABLED,
      CAN_CANCEL: row.CAN_CANCEL,
    }));
// console.log("Formatted data:", formattedData);
    return res.status(200).json({
      success: true,
      count: formattedData.length,
      data: formattedData,
    });

  } catch (error) {
    console.error("Error:", error);
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
      console.log("Missing required fields");
      return res.status(400).json({
        success: false,
        message: "Order number and barcode are required",
      });
    }

    const requestedQty = Number(QUANTITY) || 1;
    console.log("Requested quantity:", requestedQty);
    
    connection = await pool.getConnection();
    await connection.beginTransaction();
    console.log("Database connection established and transaction started");

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
    
    console.log(`Queried inventory for barcode ${BARCODE}:`, JSON.stringify(itemRows, null, 2));
    
    if (itemRows.length === 0) {
      console.log("Barcode not found in inventory");
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Barcode not found in inventory",
      });
    }

    const item = itemRows[0];
    const categoryId = Number(item.CATEGORY_ID) || 0;
    console.log("Item found:", { 
      itemCode: item.ITEM_CODE, 
      itemName: item.ITEM_NAME,
      categoryId: categoryId,
      stockQuantity: item.STOCK_QUANTITY,
      kitchen: KITCHEN 
    });
    
    console.log("Validating kitchen/bar match...");
    console.log(`KITCHEN: ${KITCHEN}, categoryId: ${categoryId}`);
    console.log(`Expected: Bar should scan CATEGORY_ID=10 (Liquor), Kitchen should scan CATEGORY_ID=14 (Snacks)`);

    // CORRECTED VALIDATION LOGIC
    // Bar (Liquor) should only scan items with CATEGORY_ID = 10
    if (KITCHEN === "Bar" && categoryId !== 10) {
      console.log(`Validation failed: Bar user scanned item with CATEGORY_ID=${categoryId}. Expected CATEGORY_ID=10 for Liquor.`);
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "This barcode is for Kitchen (Snacks). Please scan Liquor items only.",
      });
    }

    // Kitchen (Snacks) should only scan items with CATEGORY_ID = 14
    if (KITCHEN === "Kitchen" && categoryId !== 14) {
      console.log(`Validation failed: Kitchen user scanned item with CATEGORY_ID=${categoryId}. Expected CATEGORY_ID=14 for Snacks.`);
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "This barcode is for Bar (Liquor). Please scan Snacks items only.",
      });
    }
    
    console.log("Kitchen/bar validation passed");

    const stockQuantity = Number(item.STOCK_QUANTITY) || 0;
    const unitPrice = Number(item.UNIT_PRICE) || 0;
    const profitPercent = Number(item.PROFIT) || 0;
    const nonMemberProfit = Number(item.NON_MEMBER_PROFIT) || 0;
    const prCharges = Number(item.PR_CHARGES) || 0;
    const snacksPrCharges = Number(item.FOOD_PR_CHARGES) || 0;
    const pegsFromStock = Number(item.PEGS) || 1;

    console.log("Converted values:", {
      stockQuantity,
      unitPrice,
      profitPercent,
      nonMemberProfit,
      prCharges,
      snacksPrCharges,
      pegsFromStock
    });

    if (stockQuantity <= 0) {
      console.log("No stock available");
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Scanned barcode ${BARCODE} has no stock in ${KITCHEN}`,
      });
    }
    console.log("Stock validation passed");

    console.log("Fetching user role...");
    const [userRows] = await connection.query(
      `SELECT DISTINCT xu.ROLE_ID FROM xxafmc_users xu
       JOIN xxafmc_kitchen_notification xkn ON xu.USER_ID = xkn.USER_NAME
       WHERE xkn.ORDERNUMBER = ? LIMIT 1`,
      [ORDERNUMBER]
    );
    console.log(`User roles for order ${ORDERNUMBER}:`, userRows);

    const roleId = userRows.length > 0 ? Number(userRows[0].ROLE_ID) : null;
    console.log(`Role ID: ${roleId}`);

    console.log("Fetching scan statistics...");
    const [totalScannedRows] = await connection.query(
      `SELECT COALESCE(SUM(scan_quantity), 0) AS qty
       FROM order_scan_collection
       WHERE collection_name = 'S_COLLECTION'
         AND order_number = ? AND item_code = ? AND barcode = ?`,
      [ORDERNUMBER, item.ITEM_CODE, BARCODE]
    );
    
    const [scanItemRows] = await connection.query(
      `SELECT COALESCE(SUM(scan_quantity), 0) AS qty
       FROM order_scan_collection
       WHERE collection_name = 'S_COLLECTION'
         AND order_number = ? AND item_code = ?`,
      [ORDERNUMBER, item.ITEM_CODE]
    );

    const [barcodeScannedRows] = await connection.query(
      `SELECT COUNT(1) AS cnt
       FROM order_scan_collection
       WHERE collection_name = 'S_COLLECTION'
         AND order_number = ? AND barcode = ?`,
      [ORDERNUMBER, BARCODE]
    );
    
    const totalScannedQty = Number(totalScannedRows[0]?.qty || 0);
    const scanItemQty = Number(scanItemRows[0]?.qty || 0);
    const barcodeScannedQty = Number(barcodeScannedRows[0]?.cnt || 0);
    const acUnit = (item.ac_unit || "").toString();

    console.log("Scan statistics:", {
      totalScannedQty,
      scanItemQty,
      barcodeScannedQty,
      acUnit
    });

    console.log("Fetching ordered quantity...");
    const [orderQuantityRows] = await connection.query(
      `SELECT SUM(quantity) AS total_quantity
       FROM xxafmc_order_details
       WHERE ORDER_ID = ? AND ITEM_ID = ?`,
      [ORDERNUMBER, item.ITEM_CODE]
    );

    const orderedQty = Number(orderQuantityRows[0]?.total_quantity || 0);
    console.log(`Ordered quantity: ${orderedQty}`);

    console.log("Running validation checks...");
    if (["Nos", "Can", "glass"].includes(acUnit)) {
      console.log("AC Unit type: Single unit (Nos/Can/glass)");
      if (barcodeScannedQty >= 1) {
        console.log("Validation failed: Duplicate scan");
        await connection.rollback();
        return res.status(400).json({ success: false, message: `Duplicate bottle scan for ${BARCODE}` });
      }
      if (requestedQty > stockQuantity) {
        console.log("Validation failed: Requested quantity exceeds stock");
        await connection.rollback();
        return res.status(400).json({ success: false, message: `Entered quantity is more than the stock for ${BARCODE}` });
      }
      if (orderedQty > 0 && orderedQty < scanItemQty + requestedQty) {
        console.log("Validation failed: Scanned quantity exceeds order");
        await connection.rollback();
        return res.status(400).json({ success: false, message: "Scanned quantity is more than order quantity" });
      }
    } else {
      console.log("AC Unit type: Measured unit (Pegs/ml/etc)");
      if (totalScannedQty + requestedQty > stockQuantity) {
        console.log(`Validation failed: Total scanned (${totalScannedQty + requestedQty}) exceeds stock (${stockQuantity})`);
        await connection.rollback();
        return res.status(400).json({ success: false, message: `Scanned quantity is more than stock for barcode ${BARCODE}` });
      }
      if (orderedQty > 0 && orderedQty < scanItemQty + requestedQty) {
        console.log(`Validation failed: Scanned quantity (${scanItemQty + requestedQty}) exceeds order (${orderedQty})`);
        await connection.rollback();
        return res.status(400).json({ success: false, message: "Scanned quantity is more than order quantity" });
      }
    }
    console.log("All validation checks passed");

    console.log("Calculating price...");
    let calculatedPrice = unitPrice;
    const pricePerPeg = pegsFromStock > 0 ? unitPrice / pegsFromStock : unitPrice;
    console.log(`Price per peg: ${pricePerPeg}`);
    
    if (roleId === 20) {
      console.log("Member price calculation");
      const profit = pricePerPeg + (pricePerPeg * profitPercent / 100) + snacksPrCharges;
      calculatedPrice = Number(profit).toFixed(2);
      console.log(`Member profit calculation: pricePerPeg=${pricePerPeg}, profitPercent=${profitPercent}, snacksPrCharges=${snacksPrCharges}, profit=${profit}, calculatedPrice=${calculatedPrice}`);
    } else {
      console.log("Non-member price calculation");
      const profit = pricePerPeg + (pricePerPeg * nonMemberProfit / 100) + prCharges;
      calculatedPrice = Number(profit).toFixed(2);
      console.log(`Non-member profit calculation: pricePerPeg=${pricePerPeg}, nonMemberProfit=${nonMemberProfit}, prCharges=${prCharges}, profit=${profit}, calculatedPrice=${calculatedPrice}`);
    }

    console.log("Inserting into order_scan_collection...");
    const insertResult = await connection.query(
      `INSERT INTO order_scan_collection
        (collection_name, order_number, item_code, item_name, scan_quantity, 
         item_price, barcode, inventory_item_code, extra_data, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        "S_COLLECTION", ORDERNUMBER, item.ITEM_CODE, item.ITEM_NAME,
        requestedQty, calculatedPrice, BARCODE, item.ITEM_CODE,
        JSON.stringify({ kitchen_type: KITCHEN, category_id: categoryId })
      ]
    );
    console.log("Insert result:", insertResult);

    await connection.commit();
    console.log("Transaction committed successfully");

    const [finalScanRows] = await connection.query(
      `SELECT COALESCE(SUM(scan_quantity), 0) AS total_scanned
       FROM order_scan_collection
       WHERE collection_name = 'S_COLLECTION'
         AND order_number = ? AND item_code = ?`,
      [ORDERNUMBER, item.ITEM_CODE]
    );
    
    console.log(`Final scan total: ${finalScanRows[0]?.total_scanned}`);
    console.log("========== BARCODE SCAN END ==========");
    
    return res.status(201).json({
      success: true,
      message: "Barcode scanned successfully",
      data: {
        itemCode: item.ITEM_CODE,
        itemName: item.ITEM_NAME,
        categoryId: categoryId,
        stockQuantity: stockQuantity,
        unitPrice: unitPrice,
        calculatedPrice: calculatedPrice,
        orderedQuantity: orderedQty,
        requestedQuantity: requestedQty,
        scannedQuantity: Number(finalScanRows[0]?.total_scanned || 0),
        barcode: BARCODE,
        remainingToScan: orderedQty > 0 ? orderedQty - Number(finalScanRows[0]?.total_scanned || 0) : 0
      },
    });

  } catch (error) {
    if (connection) {
      console.log("Rolling back transaction due to error");
      await connection.rollback();
    }
    console.error("Error processing barcode scan:", error);
    console.error("Error stack:", error.stack);
    return res.status(500).json({
      success: false,
      message: "Failed to process barcode scan",
      error: error.message,
      stack: error.stack
    });
  } finally {
    if (connection) {
      console.log("Releasing database connection");
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