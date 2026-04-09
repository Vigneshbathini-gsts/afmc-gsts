const db = require("../config/db");

const ID_LOCKS = {
  inventory: "xxafmc_inventory_item_id_lock",
  transactions: "xxafmc_items_transactions_id_lock",
  stockOut: "xxafmc_stock_out_item_id_lock",
};

const buildInventoryQuery = ({ categoryId, itemCode, search }) => {
  const conditions = ["xi.SUB_CATEGORY NOT IN (14, 15)"];
  const params = [];

  if (categoryId) {
    conditions.push("xi.CATEGORY_ID = ?");
    params.push(Number(categoryId));
  }

  if (itemCode) {
    conditions.push("xi.ITEM_CODE = ?");
    params.push(Number(itemCode));
  }

  if (search) {
    conditions.push("(xi.ITEM_NAME LIKE ? OR CAST(xi.ITEM_CODE AS CHAR) LIKE ?)");
    const like = `%${search}%`;
    params.push(like, like);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const sql = `
      SELECT
        xi.ITEM_ID AS item_id,
        xi.ITEM_CODE AS item_code,
        xi.ITEM_NAME AS item_name,
        COALESCE(NULLIF(xi.\`A/C_UNIT\`, ''), 'Nos') AS ac_unit,
        IFNULL(xi.STOCK_QUANTITY, 0) AS stock_quantity,
        xi.ITEM_CODE AS itemid,
        xi.FILE_NAME AS file_name,
        xi.MIME_TYPE AS mime_type
    FROM xxafmc_inventory xi
    ${whereClause}
    GROUP BY xi.ITEM_CODE,
             xi.ITEM_NAME,
             xi.STOCK_QUANTITY,
             xi.\`A/C_UNIT\`,
             xi.ITEM_ID,
             xi.FILE_NAME,
             xi.MIME_TYPE
    ORDER BY xi.ITEM_ID DESC
  `;

  return { sql, params };
};

const getInventoryList = async (filters) => {
  const { sql, params } = buildInventoryQuery(filters);
  const [rows] = await db.execute(sql, params);
  return rows;
};

const getCategories = async () => {
  const sql = `
    SELECT DISTINCT
      CATEGORY_ID AS category_id,
      TRIM(CATEGORY_NAME) AS category_name
    FROM xxafmc_categories
    WHERE TRIM(IFNULL(CATEGORY_NAME, '')) <> ''
    ORDER BY CATEGORY_NAME
  `;
  const [rows] = await db.execute(sql);
  return rows;
};

const getItems = async (categoryId) => {
  const conditions = [];
  const params = [];

  if (categoryId) {
    conditions.push("CATEGORY_ID = ?");
    params.push(Number(categoryId));
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const sql = `
    SELECT DISTINCT
      ITEM_CODE AS item_code,
      TRIM(ITEM_NAME) AS item_name
    FROM xxafmc_inventory
    ${whereClause ? `${whereClause} AND` : "WHERE"} TRIM(IFNULL(ITEM_NAME, '')) <> ''
    ORDER BY ITEM_NAME
  `;
  const [rows] = await db.execute(sql, params);
  return rows;
};

const getSubCategories = async (categoryId) => {
  const conditions = [];
  const params = [];

  if (categoryId) {
    conditions.push("CATEGORY_ID = ?");
    params.push(Number(categoryId));
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const sql = `
    SELECT SUB_CATEGORY_ID AS sub_category_id, SUB_CATEGORY_NAME AS sub_category_name
    FROM xxafmc_sub_categories
    ${whereClause}
    ORDER BY SUB_CATEGORY_NAME
  `;
  const [rows] = await db.execute(sql, params);
  return rows;
};

const getCategoryDefaults = async (categoryId) => {
  const sql = `
    SELECT CATEGORY_ID AS category_id,
           PROFIT AS profit,
           FOOD_PR_CHARGES AS food_pr_charges,
           NON_MEMBER_PROFIT AS non_member_profit,
           PR_CHARGES AS pr_charges
    FROM xxafmc_inventory
    WHERE CATEGORY_ID = ?
      AND SUB_CATEGORY NOT IN (14, 15)
    GROUP BY PROFIT, FOOD_PR_CHARGES, PR_CHARGES, NON_MEMBER_PROFIT, CATEGORY_ID
    LIMIT 1
  `;
  const [rows] = await db.execute(sql, [Number(categoryId)]);
  return rows && rows.length ? rows[0] : null;
};

const acquireNamedLock = async (connection, lockName) => {
  const [rows] = await connection.execute("SELECT GET_LOCK(?, 10) AS acquired", [lockName]);
  return Number(rows[0]?.acquired || 0) === 1;
};

const releaseNamedLock = async (connection, lockName) => {
  try {
    await connection.execute("SELECT RELEASE_LOCK(?) AS released", [lockName]);
  } catch (_error) {
    // Ignore cleanup failures. The lock is connection-scoped.
  }
};

const sanitizeBarcode = (barcode) => String(barcode ?? "").trim();

const requiresVolume = (acUnit) => {
  const unit = String(acUnit || "").trim().toUpperCase();
  return unit !== "" && unit !== "NOS";
};

const validateStockInItem = (item) => {
  const numericRate = Number(item.rate);
  const normalizedBarcode = sanitizeBarcode(item.barcode);

  if (
    !item.itemCode ||
    !Number.isFinite(numericRate) ||
    numericRate <= 0 ||
    !item.transactionDate ||
    !normalizedBarcode
  ) {
    return false;
  }

  if (!/^\d{4,32}$/.test(normalizedBarcode)) {
    return false;
  }

  return true;
};

const validateStockOutItem = (item) => {
  const numericBarcode = Number(item.barcode);
  const numericQuantity = Number(item.quantity);

  return (
    Number.isFinite(numericBarcode) &&
    numericBarcode > 0 &&
    Number.isFinite(numericQuantity) &&
    numericQuantity > 0
  );
};

const createItem = async (payload) => {
  const {
    itemName,
    description,
    categoryId,
    subCategory,
    acUnit,
    prepCharges,
    createdBy,
    fileName,
    mimeType,
  } = payload;

  const connection = await db.getConnection();
  let lockAcquired = false;

  try {
    lockAcquired = await acquireNamedLock(connection, ID_LOCKS.inventory);
    if (!lockAcquired) {
      throw new Error("Unable to acquire inventory item lock");
    }

    const [nextIdRows] = await connection.execute(
      "SELECT IFNULL(MAX(ITEM_ID), 0) + 1 AS next_id FROM xxafmc_inventory"
    );
    const nextId = nextIdRows[0]?.next_id || 1;
    const defaults = await getCategoryDefaults(categoryId);

    let foodPrCharges = defaults?.food_pr_charges ?? 0;
    let prCharges = defaults?.pr_charges ?? 0;
    const profit = defaults?.profit ?? 0;
    const nonMemberProfit = defaults?.non_member_profit ?? 0;

    if (String(prepCharges).toUpperCase() === "N") {
      foodPrCharges = 0;
      prCharges = 0;
    }

    const sql = `
      INSERT INTO xxafmc_inventory
        (ITEM_ID, ITEM_CODE, ITEM_NAME, DESCRIPTION, CATEGORY_ID, SUB_CATEGORY,
         \`A/C_UNIT\`, STOCK_QUANTITY, PROFIT, FOOD_PR_CHARGES, NON_MEMBER_PROFIT,
         PR_CHARGES, CREATION_DATE, CREATED_BY, IMAGE, MIME_TYPE, FILE_NAME)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      nextId,
      nextId,
      itemName,
      description || "",
      Number(categoryId),
      subCategory ? Number(subCategory) : null,
      acUnit || "Nos",
      0,
      profit,
      foodPrCharges,
      nonMemberProfit,
      prCharges,
      new Date().toISOString(),
      createdBy || "SYSTEM",
      null,
      mimeType || null,
      fileName || null,
    ];

    await connection.execute(sql, params);

    return {
      item_id: nextId,
      item_code: nextId,
      item_name: itemName,
      ac_unit: acUnit || "Nos",
      stock_quantity: 0,
    };
  } finally {
    if (lockAcquired) {
      await releaseNamedLock(connection, ID_LOCKS.inventory);
    }
    connection.release();
  }
};

const getBarTypes = async () => {
  const sql = `
    SELECT TYPE AS type, AC_QUANTITY AS ac_quantity, TYPE_ID AS type_id, UOM AS uom
    FROM xxafmc_bar
    ORDER BY TYPE_ID
  `;
  const [rows] = await db.execute(sql);
  return rows;
};

const getInventoryItemByCode = async (itemCode) => {
  const sql = `
    SELECT ITEM_CODE AS item_code,
           ITEM_NAME AS item_name,
           \`A/C_UNIT\` AS ac_unit,
           SUB_CATEGORY AS sub_category
    FROM xxafmc_inventory
    WHERE ITEM_CODE = ?
    LIMIT 1
  `;
  const [rows] = await db.execute(sql, [Number(itemCode)]);
  return rows && rows.length ? rows[0] : null;
};

const getStockOutItemByBarcode = async (barcode, executor = db) => {
  const sql = `
    SELECT
      xit.ITEM_CODE AS item_code,
      xi.ITEM_NAME AS item_name,
      COALESCE(NULLIF(xit.\`A/C_UNIT\`, ''), NULLIF(xi.\`A/C_UNIT\`, ''), 'Nos') AS ac_unit,
      xit.RATE AS unit_price,
      xit.VOLUME AS volume,
      xit.BATCH_NAME AS batch_name,
      IFNULL(xit.PEGS, 0) AS pegs,
      IFNULL(xi.STOCK_QUANTITY, 0) AS available_stock,
      CASE
        WHEN IFNULL(xit.PEGS, 0) > 0 THEN IFNULL(xi.STOCK_QUANTITY, 0) * IFNULL(xit.PEGS, 0)
        ELSE IFNULL(xi.STOCK_QUANTITY, 0)
      END AS available_quantity
    FROM xxafmc_items_transactions xit
    JOIN xxafmc_inventory xi ON xi.ITEM_CODE = xit.ITEM_CODE
    WHERE xit.BARCODE = ?
      AND xit.FLAG = 'IN'
      AND NOT EXISTS (
        SELECT 1
        FROM xxafmc_items_transactions used_txn
        WHERE used_txn.BARCODE = xit.BARCODE
          AND used_txn.FLAG = 'OUT'
      )
    ORDER BY xit.TRANSACTION_ID DESC
    LIMIT 1
  `;
  const [rows] = await executor.execute(sql, [Number(barcode)]);
  return rows && rows.length ? rows[0] : null;
};

const getItemImageInfo = async (itemCode) => {
  const sql = `
    SELECT FILE_NAME AS file_name, MIME_TYPE AS mime_type
    FROM xxafmc_inventory
    WHERE ITEM_CODE = ?
    LIMIT 1
  `;
  const [rows] = await db.execute(sql, [Number(itemCode)]);
  return rows && rows.length ? rows[0] : null;
};

const updateItemImage = async ({ itemCode, fileName, mimeType }) => {
  const sql = `
    UPDATE xxafmc_inventory
    SET FILE_NAME = ?, MIME_TYPE = ?
    WHERE ITEM_CODE = ?
  `;
  const [result] = await db.execute(sql, [
    fileName || null,
    mimeType || null,
    Number(itemCode),
  ]);
  return result?.affectedRows || 0;
};

const getTransactionNextId = async (connection) => {
  const sql =
    "SELECT IFNULL(MAX(TRANSACTION_ID), 0) + 1 AS next_id FROM xxafmc_items_transactions";
  const [rows] = await connection.execute(sql);
  return rows[0]?.next_id || 1;
};

const barcodeExists = async (connection, barcode) => {
  const sql =
    "SELECT COUNT(1) AS cnt FROM xxafmc_items_transactions WHERE BARCODE = ?";
  const [rows] = await connection.execute(sql, [barcode]);
  return Number(rows[0]?.cnt || 0) > 0;
};

const barcodeExistsInDb = async (barcode) => {
  const sql = "SELECT COUNT(1) AS cnt FROM xxafmc_items_transactions WHERE BARCODE = ?";
  const [rows] = await db.execute(sql, [barcode]);
  return Number(rows[0]?.cnt || 0) > 0;
};

const stockOutBarcodeExists = async (executor, barcode) => {
  const sql = `
    SELECT COUNT(1) AS cnt
    FROM xxafmc_items_transactions
    WHERE BARCODE = ?
      AND FLAG = 'OUT'
  `;
  const [rows] = await executor.execute(sql, [Number(barcode)]);
  return Number(rows[0]?.cnt || 0) > 0;
};

const stockOutRecordExists = async (executor, barcode) => {
  const sql = `
    SELECT COUNT(1) AS cnt
    FROM xxafmc_stock_out
    WHERE BARCODE = ?
  `;
  const [rows] = await executor.execute(sql, [Number(barcode)]);
  return Number(rows[0]?.cnt || 0) > 0;
};

const stockOutBarcodeExistsInDb = async (barcode) => {
  const [transactionExists, stockOutExists] = await Promise.all([
    stockOutBarcodeExists(db, barcode),
    stockOutRecordExists(db, barcode),
  ]);
  return transactionExists || stockOutExists;
};

const parseVolumeToNumber = (volume) => {
  if (!volume) return null;
  const match = String(volume).match(/(\d+(\.\d+)?)/);
  return match ? Number(match[1]) : null;
};

const normalizeTransactionDate = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [mm, dd, yyyy] = raw.split("/");
    return `${yyyy}-${mm}-${dd}`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const normalizeReportDate = (value) => normalizeTransactionDate(value);

const calculatePegs = ({ subCategory, typeId, volume, acQuantity }) => {
  const volumeNumber = parseVolumeToNumber(volume);
  if (!volumeNumber || !acQuantity) return 0;

  const subCat = Number(subCategory);
  const type = Number(typeId);
  const eligibleSubCats = [2, 4, 5, 8, 11, 12, 16, 17];
  const eligibleTypes = [3, 4, 5, 6];

  if (eligibleSubCats.includes(subCat) || eligibleTypes.includes(type)) {
    return volumeNumber / acQuantity;
  }

  if (subCat === 6 && type === 5) {
    return volumeNumber / acQuantity;
  }

  return 0;
};

const addStockTransactions = async (payload) => {
  const items = Array.isArray(payload) ? payload : [payload];

  const barcodes = items
    .map((item) => item.barcode)
    .filter((barcode) => barcode !== undefined && barcode !== null && barcode !== "");

  const uniqueBarcodes = new Set(barcodes);
  if (uniqueBarcodes.size !== barcodes.length) {
    const error = new Error("DUPLICATE_BARCODE");
    error.code = "DUPLICATE_BARCODE";
    throw error;
  }

  const connection = await db.getConnection();
  let transactionLockAcquired = false;
  try {
    await connection.beginTransaction();
    transactionLockAcquired = await acquireNamedLock(connection, ID_LOCKS.transactions);
    if (!transactionLockAcquired) {
      throw new Error("Unable to acquire transaction ID lock");
    }

    for (const barcode of barcodes) {
      const exists = await barcodeExists(connection, barcode);
      if (exists) {
        const error = new Error("DUPLICATE_BARCODE");
        error.code = "DUPLICATE_BARCODE";
        throw error;
      }
    }

    let nextId = await getTransactionNextId(connection);

    for (const item of items) {
      const {
        itemCode,
        quantity,
        transactionDate,
        volume,
        barcode,
        rate,
        batchId,
        createdBy,
        acUnit,
      } = item;

      const normalizedBarcode = sanitizeBarcode(barcode);
      const numericQuantity = 1;

      if (!validateStockInItem({ ...item, barcode: normalizedBarcode })) {
        const error = new Error("INVALID_DATA");
        error.code = "INVALID_DATA";
        throw error;
      }

      const normalizedTransactionDate = normalizeTransactionDate(transactionDate);
      if (!normalizedTransactionDate) {
        const error = new Error("INVALID_DATA");
        error.code = "INVALID_DATA";
        throw error;
      }

      const inventoryItem = await getInventoryItemByCode(itemCode);
      if (!inventoryItem) {
        const error = new Error("ITEM_NOT_FOUND");
        error.code = "ITEM_NOT_FOUND";
        throw error;
      }

      const effectiveAcUnit = acUnit || inventoryItem.ac_unit || "Nos";
      if (requiresVolume(effectiveAcUnit) && !String(volume || "").trim()) {
        const error = new Error("INVALID_DATA");
        error.code = "INVALID_DATA";
        throw error;
      }
      const [barRows] = await connection.execute(
        "SELECT AC_QUANTITY AS ac_quantity, TYPE_ID AS type_id FROM xxafmc_bar WHERE TYPE = ? LIMIT 1",
        [effectiveAcUnit]
      );
      const barRow = barRows && barRows.length ? barRows[0] : null;

      const pegs = calculatePegs({
        subCategory: inventoryItem.sub_category,
        typeId: barRow?.type_id,
        volume,
        acQuantity: barRow?.ac_quantity,
      });

      const batchName = `${inventoryItem.item_name}-${numericQuantity}-${volume || ""}-${transactionDate}`;

      const insertSql = `
        INSERT INTO xxafmc_items_transactions
          (TRANSACTION_ID, ITEM_CODE, \`A/C_UNIT\`, RATE, STOCK, BATCH_NAME, VOLUME,
           TRANSACTION_DATE, FLAG, BATCH_ID, BARCODE, PEGS, CREATED_BY, CREATION_DATE)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await connection.execute(insertSql, [
        nextId,
        Number(itemCode),
        effectiveAcUnit,
        Number(rate),
        numericQuantity,
        batchName,
        volume || "",
        normalizedTransactionDate,
        "IN",
        batchId || "",
        normalizedBarcode,
        Math.round(Number(pegs || 0)),
        createdBy || "SYSTEM",
        new Date().toISOString(),
      ]);

      const updateSql = `
        UPDATE xxafmc_inventory
        SET STOCK_QUANTITY = IFNULL(STOCK_QUANTITY, 0) + ?,
            UNIT_PRICE = ?
        WHERE ITEM_CODE = ?
      `;
      await connection.execute(updateSql, [
        numericQuantity,
        Number(rate),
        Number(itemCode),
      ]);

      nextId += 1;
    }

    await connection.commit();
    return { count: items.length };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    if (transactionLockAcquired) {
      await releaseNamedLock(connection, ID_LOCKS.transactions);
    }
    connection.release();
  }
};

const getStockOutNextId = async (connection) => {
  const sql = "SELECT IFNULL(MAX(ITEM_ID), 0) + 1 AS next_id FROM xxafmc_stock_out";
  const [rows] = await connection.execute(sql);
  return rows[0]?.next_id || 1;
};

const addStockOutTransactions = async (payload) => {
  const items = Array.isArray(payload) ? payload : [payload];

  if (!items.length) {
    const error = new Error("INVALID_DATA");
    error.code = "INVALID_DATA";
    throw error;
  }

  const barcodes = items.map((item) => sanitizeBarcode(item.barcode));
  const uniqueBarcodes = new Set(barcodes);
  if (uniqueBarcodes.size !== barcodes.length) {
    const error = new Error("INVALID_DATA");
    error.code = "INVALID_DATA";
    throw error;
  }

  const connection = await db.getConnection();
  let stockOutLockAcquired = false;
  let transactionLockAcquired = false;
  try {
    await connection.beginTransaction();
    stockOutLockAcquired = await acquireNamedLock(connection, ID_LOCKS.stockOut);
    transactionLockAcquired = await acquireNamedLock(connection, ID_LOCKS.transactions);
    if (!stockOutLockAcquired || !transactionLockAcquired) {
      throw new Error("Unable to acquire stock-out ID lock");
    }

    let nextStockOutId = await getStockOutNextId(connection);
    let nextTransactionId = await getTransactionNextId(connection);

    for (const item of items) {
      const {
        barcode,
        quantity,
        transactionDate,
        createdBy,
      } = item;

      const numericBarcode = Number(barcode);
      const numericQuantity = Number(quantity);
      const normalizedTransactionDate = normalizeTransactionDate(transactionDate);

      if (!validateStockOutItem(item) || !normalizedTransactionDate) {
        const error = new Error("INVALID_DATA");
        error.code = "INVALID_DATA";
        throw error;
      }

      const stockItem = await getStockOutItemByBarcode(numericBarcode, connection);
      if (!stockItem) {
        const error = new Error("ITEM_NOT_FOUND");
        error.code = "ITEM_NOT_FOUND";
        throw error;
      }

      const [alreadyConsumedByTxn, alreadyConsumedByStockOut] = await Promise.all([
        stockOutBarcodeExists(connection, numericBarcode),
        stockOutRecordExists(connection, numericBarcode),
      ]);
      const alreadyConsumed = alreadyConsumedByTxn || alreadyConsumedByStockOut;
      if (alreadyConsumed) {
        const error = new Error("BARCODE_ALREADY_USED");
        error.code = "BARCODE_ALREADY_USED";
        throw error;
      }

      const divisor = Number(stockItem.pegs) > 0 ? Number(stockItem.pegs) : 1;
      const inventoryDelta = numericQuantity / divisor;

      if (Number(stockItem.available_stock || 0) < inventoryDelta) {
        const error = new Error("INSUFFICIENT_STOCK");
        error.code = "INSUFFICIENT_STOCK";
        throw error;
      }

      const totalValue = Number(stockItem.unit_price || 0) * numericQuantity;
      const creationTimestamp = new Date().toISOString();

      await connection.execute(
        `
          INSERT INTO xxafmc_stock_out
            (ITEM_ID, ITEM_NAME, ITEM_CODE, UNIT_PRICE, STOCK_QUANTITY, TOTAL_VALUE,
             BARCODE, CREATION_DATE, PEGS, \`A/C_UNIT\`, VOLUME, BATCH_NAME,
             MSG_READ, STATUS, CREATED_BY)
          VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          nextStockOutId,
          stockItem.item_name,
          Number(stockItem.item_code),
          Number(stockItem.unit_price || 0),
          numericQuantity,
          totalValue,
          numericBarcode,
          creationTimestamp,
          Number(stockItem.pegs || 0),
          stockItem.ac_unit || "Nos",
          stockItem.volume || "",
          stockItem.batch_name || "",
          "N",
          "CLOSED",
          createdBy || "SYSTEM",
        ]
      );

      await connection.execute(
        `
          INSERT INTO xxafmc_items_transactions
            (TRANSACTION_ID, ITEM_CODE, \`A/C_UNIT\`, RATE, STOCK, TOTAL_VALUE,
             PEGS, VOLUME, BATCH_NAME, TRANSACTION_DATE, FLAG, BARCODE,
             CREATED_BY, CREATION_DATE)
          VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          nextTransactionId,
          Number(stockItem.item_code),
          stockItem.ac_unit || "Nos",
          Number(stockItem.unit_price || 0),
          numericQuantity,
          totalValue,
          Number(stockItem.pegs || 0),
          stockItem.volume || "",
          stockItem.batch_name || "",
          normalizedTransactionDate,
          "OUT",
          numericBarcode,
          createdBy || "SYSTEM",
          creationTimestamp,
        ]
      );

      await connection.execute(
        `
          UPDATE xxafmc_inventory
          SET STOCK_QUANTITY = IFNULL(STOCK_QUANTITY, 0) - ?
          WHERE ITEM_CODE = ?
        `,
        [inventoryDelta, Number(stockItem.item_code)]
      );

      nextStockOutId += 1;
      nextTransactionId += 1;
    }

    await connection.commit();
    return { count: items.length };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    if (stockOutLockAcquired) {
      await releaseNamedLock(connection, ID_LOCKS.stockOut);
    }
    if (transactionLockAcquired) {
      await releaseNamedLock(connection, ID_LOCKS.transactions);
    }
    connection.release();
  }
};

const getStockInReport = async ({ fromDate, toDate }) => {
  const normalizedFrom = normalizeReportDate(fromDate);
  const normalizedTo = normalizeReportDate(toDate);
  const sql = `
    SELECT
      XIT.ITEM_CODE AS item_code,
      XI.ITEM_NAME AS item_name,
      XIT.BATCH_ID AS batch_id,
      COALESCE(NULLIF(XI.\`A/C_UNIT\`, ''), 'Nos') AS ac_unit,
      SUM(XIT.STOCK) AS stock,
      ROUND(SUM(IFNULL(XIT.RATE, 0) * IFNULL(XIT.STOCK, 0)), 2) AS total_price,
      MIN(XIT.CREATION_DATE) AS creation_date
    FROM xxafmc_items_transactions XIT
    JOIN xxafmc_inventory XI ON XIT.ITEM_CODE = XI.ITEM_CODE
    WHERE DATE(XIT.TRANSACTION_DATE) BETWEEN COALESCE(?, CURDATE())
      AND COALESCE(?, CURDATE())
      AND XIT.FLAG = 'IN'
      AND XI.SUB_CATEGORY NOT IN (14, 15)
    GROUP BY XIT.ITEM_CODE, XI.ITEM_NAME, XIT.BATCH_ID, XI.\`A/C_UNIT\`
    ORDER BY creation_date DESC
  `;
  const [rows] = await db.execute(sql, [normalizedFrom, normalizedTo]);
  return rows;
};

const getStockOutReport = async ({ fromDate, toDate }) => {
  const normalizedFrom = normalizeReportDate(fromDate);
  const normalizedTo = normalizeReportDate(toDate);
  const sql = `
    SELECT
      XSO.ITEM_CODE AS item_code,
      XSO.ITEM_NAME AS item_name,
      SUM(XSO.STOCK_QUANTITY) AS stock,
      ROUND(SUM(IFNULL(XSO.TOTAL_VALUE, 0)), 2) AS total_price,
      MIN(XSO.CREATION_DATE) AS creation_date,
      COALESCE(NULLIF(XI.\`A/C_UNIT\`, ''), 'Nos') AS ac_unit
    FROM xxafmc_stock_out XSO
    JOIN xxafmc_inventory XI ON XSO.ITEM_CODE = XI.ITEM_CODE
    WHERE DATE(XSO.CREATION_DATE) BETWEEN COALESCE(?, CURDATE())
      AND COALESCE(?, CURDATE())
    GROUP BY XSO.ITEM_NAME, XSO.ITEM_CODE, XI.\`A/C_UNIT\`
    ORDER BY creation_date DESC
  `;
  const [rows] = await db.execute(sql, [normalizedFrom, normalizedTo]);
  return rows;
};

module.exports = {
  getInventoryList,
  getCategories,
  getItems,
  getSubCategories,
  createItem,
  getBarTypes,
  getStockOutItemByBarcode,
  barcodeExistsInDb,
  stockOutBarcodeExistsInDb,
  addStockTransactions,
  addStockOutTransactions,
  getItemImageInfo,
  updateItemImage,
  getStockInReport,
  getStockOutReport,
};
