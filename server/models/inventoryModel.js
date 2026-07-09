const db = require("../config/db");
const { formatToSql, getStartOfDay, getEndOfDay, parseDate } = require("../utils/dateUtils");

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
        xi.CATEGORY_ID AS category_id,
        xi.SUB_CATEGORY AS sub_category,
        xs.SUB_CATEGORY_NAME AS item_group,
        COALESCE(NULLIF(xi.\`A/C_UNIT\`, ''), 'Nos') AS ac_unit,
        IFNULL(xi.STOCK_QUANTITY, 0) AS stock_quantity,
        IFNULL(xi.PROFIT, 0) AS profit,
        xi.ITEM_CODE AS itemid,
        xi.FILE_NAME AS file_name,
        xi.MIME_TYPE AS mime_type
    FROM xxafmc_inventory xi
    LEFT JOIN xxafmc_sub_categories xs ON xs.SUB_CATEGORY_ID = xi.SUB_CATEGORY
    ${whereClause}
    GROUP BY xi.ITEM_CODE,
             xi.ITEM_NAME,
             xi.CATEGORY_ID,
             xi.SUB_CATEGORY,
             xs.SUB_CATEGORY_NAME,
             xi.STOCK_QUANTITY,
             xi.PROFIT,
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
  const limit = Number(filters?.limit);
  const offset = Number(filters?.offset);
  const hasPagination =
    Number.isInteger(limit) && limit > 0 && Number.isInteger(offset) && offset >= 0;
  const pagedSql = hasPagination ? `${sql} LIMIT ${limit} OFFSET ${offset}` : sql;
  const [rows] = await db.execute(pagedSql, params);
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

const subCategoryBelongsToCategory = async (categoryId, subCategoryId, executor = db) => {
  if (!categoryId || !subCategoryId) return false;

  const sql = `
    SELECT COUNT(1) AS cnt
    FROM xxafmc_sub_categories
    WHERE CATEGORY_ID = ?
      AND SUB_CATEGORY_ID = ?
  `;
  const [rows] = await executor.execute(sql, [Number(categoryId), Number(subCategoryId)]);
  return Number(rows[0]?.cnt || 0) > 0;
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

const getDefaultServingVolume = (subCategory, acUnit) => {
  const sub = Number(subCategory);
  const unit = String(acUnit || "").trim().toLowerCase();

  if (sub === 6 && unit === "glass") return "200";
  if (sub === 9 && unit === "glass") return "250";
  return "";
};

const validateStockOutItem = (item) => {
  const numericQuantity = Number(item.quantity);
  const normalizedBarcode = sanitizeBarcode(item.barcode);

  return (
    /^\d{4,32}$/.test(normalizedBarcode) &&
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
    servingVolume,
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

    if (subCategory) {
      const isValidSubCategory = await subCategoryBelongsToCategory(
        categoryId,
        subCategory,
        connection
      );
      if (!isValidSubCategory) {
        const error = new Error("INVALID_SUB_CATEGORY");
        error.code = "INVALID_SUB_CATEGORY";
        throw error;
      }
    }

    const defaults = await getCategoryDefaults(categoryId);

    let foodPrCharges = defaults?.food_pr_charges ?? 0;
    let prCharges = defaults?.pr_charges ?? 0;
    const profit = defaults?.profit ?? 0;
    const nonMemberProfit = defaults?.non_member_profit ?? 0;

    if (String(prepCharges).toUpperCase() === "N") {
      foodPrCharges = 0;
      prCharges = 0;
    }

    const normalizedAcUnit = acUnit || "Nos";
    const defaultServingVolume = getDefaultServingVolume(subCategory, normalizedAcUnit);
    const pegs = defaultServingVolume || servingVolume || "";

    const sql = `
      INSERT INTO xxafmc_inventory
        (ITEM_ID, ITEM_CODE, ITEM_NAME, DESCRIPTION, CATEGORY_ID, SUB_CATEGORY,
         \`A/C_UNIT\`, PEGS, STOCK_QUANTITY, PROFIT, FOOD_PR_CHARGES, NON_MEMBER_PROFIT,
         PR_CHARGES, CREATION_DATE, CREATED_BY, IMAGE, MIME_TYPE, FILE_NAME)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      nextId,
      nextId,
      itemName,
      description || "",
      Number(categoryId),
      subCategory ? Number(subCategory) : null,
      normalizedAcUnit,
      pegs,
      0,
      profit,
      foodPrCharges,
      nonMemberProfit,
      prCharges,
      formatToSql(new Date()),
      createdBy || "SYSTEM",
      fileName || null,
      mimeType || null,
      fileName || null,
    ];

    await connection.execute(sql, params);

    return {
      item_id: nextId,
      item_code: nextId,
      item_name: itemName,
      ac_unit: normalizedAcUnit,
      pegs,
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

const getItemById = async (itemId) => {
  const sql = `
    SELECT 
      ITEM_ID,
      ITEM_NAME,
      DESCRIPTION,
      ITEM_CODE,
      CATEGORY_ID,
      SUB_CATEGORY,
      UNIT_PRICE,
      FOOD_PR_CHARGES,
      PROFIT,
      NON_MEMBER_PROFIT,
      PR_CHARGES,
      \`A/C_UNIT\`,
      (
  SELECT IFNULL(SUM(xso.STOCK_QUANTITY),0)
  FROM xxafmc_stock_out xso
  WHERE xso.ITEM_CODE = xxafmc_inventory.ITEM_CODE
) AS STOCK_QUANTITY,
      CASE
        WHEN IFNULL(TRIM(IMAGE), '') = '' THEN NULL
        WHEN IMAGE LIKE 'http%' THEN IMAGE
        WHEN IMAGE LIKE '/uploads/%' THEN IMAGE
        ELSE CONCAT('/apex_image_endpoint?item_id=', ITEM_ID)
      END AS IMAGE_URL,
      CREATED_BY,
      CREATION_DATE
    FROM xxafmc_inventory
    WHERE ITEM_ID = ?
    LIMIT 1
  `;
  const [rows] = await db.execute(sql, [Number(itemId)]);
  return rows && rows.length ? rows[0] : null;
};

const getStockOutItemByBarcode = async (barcode, executor = db) => {
  const normalizedBarcode = sanitizeBarcode(barcode);
  const sql = `
    SELECT
      xit.ITEM_CODE AS item_code,
      xi.ITEM_NAME AS item_name,
      xit.STOCK AS barcode_qty,
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
  const [rows] = await executor.execute(sql, [normalizedBarcode]);
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
    SET IMAGE = ?, FILE_NAME = ?, MIME_TYPE = ?
    WHERE ITEM_CODE = ?
  `;
  const [result] = await db.execute(sql, [
    fileName || null,
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
  const normalizedBarcode = sanitizeBarcode(barcode);
  const sql = `
    SELECT COUNT(1) AS cnt
    FROM xxafmc_items_transactions
    WHERE BARCODE = ?
      AND FLAG = 'OUT'
  `;
  const [rows] = await executor.execute(sql, [normalizedBarcode]);
  return Number(rows[0]?.cnt || 0) > 0;
};

const stockOutRecordExists = async (executor, barcode) => {
  const normalizedBarcode = sanitizeBarcode(barcode);
  const sql = `
    SELECT COUNT(1) AS cnt
    FROM xxafmc_stock_out
    WHERE BARCODE = ?
  `;
  const [rows] = await executor.execute(sql, [normalizedBarcode]);
  return Number(rows[0]?.cnt || 0) > 0;
};

const stockOutBarcodeExistsInDb = async (barcode) => {
  const [transactionExists, stockOutExists] = await Promise.all([
    stockOutBarcodeExists(db, barcode),
    stockOutRecordExists(db, barcode),
  ]);
  return transactionExists || stockOutExists;
};

const normalizeTransactionDate = (value) => {
  const parsed = parseDate(value);
  return parsed ? parsed.toISOString().split('T')[0] : null;
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

      const normalizedBarcode = sanitizeBarcode(barcode);
      const numericQuantity = Number(quantity);
      const normalizedTransactionDate = normalizeTransactionDate(transactionDate);

      if (!validateStockOutItem(item) || !normalizedTransactionDate) {
        const error = new Error("INVALID_DATA");
        error.code = "INVALID_DATA";
        throw error;
      }

      const stockItem = await getStockOutItemByBarcode(normalizedBarcode, connection);
      if (!stockItem) {
        const error = new Error("ITEM_NOT_FOUND");
        error.code = "ITEM_NOT_FOUND";
        throw error;
      }

      const [alreadyConsumedByTxn, alreadyConsumedByStockOut] = await Promise.all([
        stockOutBarcodeExists(connection, normalizedBarcode),
        stockOutRecordExists(connection, normalizedBarcode),
      ]);
      const alreadyConsumed = alreadyConsumedByTxn || alreadyConsumedByStockOut;
      if (alreadyConsumed) {
        const error = new Error("BARCODE_ALREADY_USED");
        error.code = "BARCODE_ALREADY_USED";
        throw error;
      }

      const inventoryDelta = numericQuantity;

      if (Number(stockItem.available_stock || 0) < inventoryDelta) {
        const error = new Error("INSUFFICIENT_STOCK");
        error.code = "INSUFFICIENT_STOCK";
        throw error;
      }

      const bottlePrice = Number(stockItem.unit_price || 0);
      const stockOutQuantity = numericQuantity;
      const totalValue = bottlePrice * stockOutQuantity;
      const creationTimestamp = formatToSql(new Date());

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
          stockOutQuantity,
          totalValue,
          normalizedBarcode,
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
          stockOutQuantity,
          totalValue,
          Number(stockItem.pegs || 0),
          stockItem.volume || "",
          stockItem.batch_name || "",
          normalizedTransactionDate,
          "OUT",
          normalizedBarcode,
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

    await connection.execute(
      "DELETE FROM xxafmc_items_transactions WHERE ITEM_CODE IS NULL AND FLAG = 'OUT'"
    );

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

const normalizeAcUnit = (value) => {
  const unit = String(value || "").trim().toLowerCase();
  if (unit.includes("can")) return "Can";
  if (unit.includes("peg")) return "Pegs";
  return "Nos";
};

const mapAcUnitRows = (rows) =>
  rows.map((row) => ({
    ...row,
    ac_unit: normalizeAcUnit(row.ac_unit),
  }));

const getStockInReport = async ({ fromDate, toDate, limit, offset }) => {
  const start = getStartOfDay(fromDate);
  const end = getEndOfDay(toDate);
  const limitNumber = Number(limit);
  const offsetNumber = Number(offset);
  const hasPagination =
    Number.isInteger(limitNumber) &&
    limitNumber > 0 &&
    Number.isInteger(offsetNumber) &&
    offsetNumber >= 0;
  const sql = `
    SELECT
      XIT.ITEM_CODE AS item_code,
      XI.ITEM_NAME AS item_name,
      COALESCE(NULLIF(XI.\`A/C_UNIT\`, ''), 'Nos') AS ac_unit,
      SUM(XIT.STOCK) AS stock,
      ROUND(SUM(IFNULL(XIT.RATE, 0)), 2) AS total_price,
      MIN(XIT.TRANSACTION_DATE) AS transaction_date,
      MIN(XIT.CREATION_DATE) AS creation_date
    FROM xxafmc_items_transactions XIT
    JOIN xxafmc_inventory XI ON XIT.ITEM_CODE = XI.ITEM_CODE
    WHERE XIT.TRANSACTION_DATE >= ? AND XIT.TRANSACTION_DATE <= ?
      AND XIT.FLAG = 'IN'
      AND XI.SUB_CATEGORY NOT IN (14, 15)
    GROUP BY XIT.ITEM_CODE, XI.ITEM_NAME, XI.\`A/C_UNIT\`
    ORDER BY creation_date DESC
    ${hasPagination ? `LIMIT ${limitNumber} OFFSET ${offsetNumber}` : ""}
  `;
  const [rows] = await db.execute(sql, [start, end]);
  return mapAcUnitRows(rows);
 }; 
// ROUND(SUM(IFNULL(XIT.RATE, 0) * IFNULL(XIT.STOCK, 0)), 2) AS total_price,

const getStockInReportSummary = async ({ fromDate, toDate }) => {
  const start = getStartOfDay(fromDate);
  const end = getEndOfDay(toDate);
  const sql = `
    SELECT
      IFNULL(SUM(XIT.STOCK), 0) AS total_stock,
      ROUND(SUM(IFNULL(XIT.RATE, 0)), 2) AS total_price
    FROM xxafmc_items_transactions XIT
    JOIN xxafmc_inventory XI ON XIT.ITEM_CODE = XI.ITEM_CODE
    WHERE XIT.TRANSACTION_DATE >= ? AND XIT.TRANSACTION_DATE <= ?
      AND XIT.FLAG = 'IN'
      AND XI.SUB_CATEGORY NOT IN (14, 15)
  `;
  const [rows] = await db.execute(sql, [start, end]);
  return rows[0] || { total_stock: 0, total_price: 0 };
};

const getStockOutReport = async ({ fromDate, toDate, limit, offset }) => {
  const start = getStartOfDay(fromDate);
  const end = getEndOfDay(toDate);
  const limitNumber = Number(limit);
  const offsetNumber = Number(offset);
  const hasPagination =
    Number.isInteger(limitNumber) &&
    limitNumber > 0 &&
    Number.isInteger(offsetNumber) &&
    offsetNumber >= 0;
  const sql = `
    SELECT
      XSO.ITEM_CODE AS item_code,
      XSO.ITEM_NAME AS item_name,
      SUM(XSO.STOCK_QUANTITY) AS stock,
      ROUND(SUM(IFNULL(XSO.UNIT_PRICE, 0)), 2) AS total_price,
      MIN(XSO.CREATION_DATE) AS creation_date,
      COALESCE(NULLIF(XI.\`A/C_UNIT\`, ''), 'Nos') AS ac_unit
    FROM xxafmc_stock_out XSO
    JOIN xxafmc_inventory XI ON XSO.ITEM_CODE = XI.ITEM_CODE
    WHERE XSO.CREATION_DATE >= ? AND XSO.CREATION_DATE <= ?
    GROUP BY XSO.ITEM_NAME, XSO.ITEM_CODE, XI.\`A/C_UNIT\`
    ORDER BY creation_date DESC
    ${hasPagination ? `LIMIT ${limitNumber} OFFSET ${offsetNumber}` : ""}
  `;
  const [rows] = await db.execute(sql, [start, end]);
  return mapAcUnitRows(rows);
};

const getStockOutReportSummary = async ({ fromDate, toDate }) => {
  const start = getStartOfDay(fromDate);
  const end = getEndOfDay(toDate);
  const sql = `
    SELECT
      IFNULL(SUM(XSO.STOCK_QUANTITY), 0) AS total_stock,
      ROUND(SUM(IFNULL(XSO.TOTAL_VALUE, 0)), 2) AS total_price
    FROM xxafmc_stock_out XSO
    JOIN xxafmc_inventory XI ON XSO.ITEM_CODE = XI.ITEM_CODE
    WHERE XSO.CREATION_DATE >= ? AND XSO.CREATION_DATE <= ?
  `;
  const [rows] = await db.execute(sql, [start, end]);
  return rows[0] || { total_stock: 0, total_price: 0 };
};

const getTodayStockOutDetails = async () => {
  const sql = `
    SELECT
      ITEM_ID,
      ROUND(STOCK_QUANTITY) AS stock_quantity,
      ITEM_NAME,
      UNIT_PRICE,
      CREATION_DATE,
      CREATED_BY,
      LAST_UPDATE_DATE,
      LAST_UPDATED_BY,
      ITEM_CODE,
      \`A/C_UNIT\` AS ac_unit,
      PEGS,
      BOTTLES,
      TOTAL_VALUE,
      volume,
      batch_name,
      type,
      BARCODE
    FROM xxafmc_stock_out
    WHERE DATE(CREATION_DATE) = CURDATE()
      AND ITEM_CODE IS NOT NULL
    ORDER BY CREATION_DATE DESC
  `;
  const [rows] = await db.execute(sql);
  return rows;
};

module.exports = {
  getInventoryList,
  getCategories,
  getItems,
  getSubCategories,
  createItem,
  getBarTypes,
  getItemById,
  getStockOutItemByBarcode,
  barcodeExistsInDb,
  stockOutBarcodeExistsInDb,
  addStockOutTransactions,
  getItemImageInfo,
  updateItemImage,
  getStockInReport,
  getStockInReportSummary,
  getStockOutReport,
  getStockOutReportSummary,
  getTodayStockOutDetails,
};
