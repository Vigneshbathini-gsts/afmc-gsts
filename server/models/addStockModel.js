const db = require("../config/db");
const { formatToSql, parseDate } = require("../utils/dateUtils");

const TRANSACTION_LOCK = "xxafmc_items_transactions_id_lock";
const SINGLE_QUANTITY_SUB_CATEGORIES = new Set([3, 1310]);

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
  const numericQuantity = Number(item.quantity);
  const normalizedBarcode = sanitizeBarcode(item.barcode);

  if (
    !item.itemCode ||
    !Number.isFinite(numericRate) ||
    numericRate <= 0 ||
    !Number.isInteger(numericQuantity) ||
    numericQuantity <= 0 ||
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

const requiresSingleQuantity = (subCategory) =>
  SINGLE_QUANTITY_SUB_CATEGORIES.has(Number(subCategory));

const requiresSingleQuantityForUnit = (subCategoryId, acUnit) => {
  // Beer subcategory (1): Nos and Can require quantity=1, but Glass allows multiple
  if (Number(subCategoryId) === 1) {
    const unit = String(acUnit || "").trim().toUpperCase();
    return unit === "NOS" || unit === "CAN";
  }
  return false;
};

const normalizeBatchPart = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/-/g, " ");

const normalizeTransactionDate = (value) => {
  const parsed = parseDate(value);
  return parsed ? parsed.toISOString().split("T")[0] : null;
};

const getNextBatchId = async ({ itemCode, transactionDate }, executor = db) => {
  const normalizedTransactionDate = normalizeTransactionDate(transactionDate);
  if (!itemCode || !normalizedTransactionDate) {
    const error = new Error("INVALID_DATA");
    error.code = "INVALID_DATA";
    throw error;
  }

  const inventoryItem = await getInventoryItemByCode(itemCode, executor);
  if (!inventoryItem) {
    const error = new Error("ITEM_NOT_FOUND");
    error.code = "ITEM_NOT_FOUND";
    throw error;
  }

  const batchPrefix = `${normalizeBatchPart(inventoryItem.item_name) || "Item"}-${normalizedTransactionDate}-`;
  const [rows] = await executor.execute(
    `
      SELECT IFNULL(MAX(CAST(SUBSTRING(BATCH_ID, ?) AS UNSIGNED)), 0) + 1 AS next_sequence
      FROM xxafmc_items_transactions
      WHERE ITEM_CODE = ?
        AND TRANSACTION_DATE = ?
        AND FLAG = 'IN'
        AND BATCH_ID LIKE ?
    `,
    [
      batchPrefix.length + 1,
      Number(itemCode),
      normalizedTransactionDate,
      `${batchPrefix}%`,
    ]
  );

  const nextSequence = Number(rows[0]?.next_sequence || 1);
  return `${batchPrefix}${String(nextSequence).padStart(3, "0")}`;
};

const getTransactionNextId = async (connection) => {
  const sql =
    "SELECT IFNULL(MAX(TRANSACTION_ID), 0) + 1 AS next_id FROM xxafmc_items_transactions";
  const [rows] = await connection.execute(sql);
  return rows[0]?.next_id || 1;
};

const barcodeExists = async (connection, barcode) => {
  const sql = "SELECT COUNT(1) AS cnt FROM xxafmc_items_transactions WHERE BARCODE = ?";
  const [rows] = await connection.execute(sql, [barcode]);
  return Number(rows[0]?.cnt || 0) > 0;
};

const getInventoryItemByCode = async (itemCode, executor = db) => {
  const sql = `
    SELECT ITEM_CODE AS item_code,
           ITEM_NAME AS item_name,
           \`A/C_UNIT\` AS ac_unit,
           SUB_CATEGORY AS sub_category,
           FLAG AS prep_charges
    FROM xxafmc_inventory
    WHERE ITEM_CODE = ?
    LIMIT 1
  `;
  const [rows] = await executor.execute(sql, [Number(itemCode)]);
  return rows && rows.length ? rows[0] : null;
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
    transactionLockAcquired = await acquireNamedLock(connection, TRANSACTION_LOCK);
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
        createdBy,
        acUnit,
      } = item;

      const normalizedBarcode = sanitizeBarcode(barcode);
      const numericQuantity = Number(quantity);

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

      const inventoryItem = await getInventoryItemByCode(itemCode, connection);
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

      if (requiresSingleQuantity(inventoryItem.sub_category) && numericQuantity !== 1) {
        const error = new Error("INVALID_SINGLE_QUANTITY");
        error.code = "INVALID_SINGLE_QUANTITY";
        throw error;
      }

      if (requiresSingleQuantityForUnit(inventoryItem.sub_category, effectiveAcUnit) && numericQuantity !== 1) {
        const error = new Error("INVALID_SINGLE_QUANTITY");
        error.code = "INVALID_SINGLE_QUANTITY";
        throw error;
      }

      const batchId = await getNextBatchId(
        { itemCode, transactionDate: normalizedTransactionDate },
        connection
      );
      const batchName = batchId;

      await connection.execute(
        `
          INSERT INTO xxafmc_items_transactions
            (TRANSACTION_ID, ITEM_CODE, \`A/C_UNIT\`, RATE, STOCK, BATCH_NAME, VOLUME,
             TRANSACTION_DATE, FLAG, BATCH_ID, BARCODE, PEGS, CREATED_BY, CREATION_DATE)
          VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
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
          numericQuantity,
          createdBy || "SYSTEM",
          formatToSql(new Date()),
        ]
      );

      await connection.execute(
        `
          UPDATE xxafmc_inventory
          SET STOCK_QUANTITY = IFNULL(STOCK_QUANTITY, 0) + ?,
              UNIT_PRICE = ?,
              FLAG = COALESCE(NULLIF(?, ''), FLAG)
          WHERE ITEM_CODE = ?
        `,
        [
          numericQuantity,
          Number(rate),
          inventoryItem.prep_charges ? String(inventoryItem.prep_charges).toUpperCase() : null,
          Number(itemCode),
        ]
      );

      nextId += 1;
    }

    await connection.commit();
    return { count: items.length };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    if (transactionLockAcquired) {
      await releaseNamedLock(connection, TRANSACTION_LOCK);
    }
    connection.release();
  }
};

module.exports = {
  addStockTransactions,
  getNextBatchId,
};
