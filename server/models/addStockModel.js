const db = require("../config/db");
const { formatToSql, parseDate } = require("../utils/dateUtils");

const TRANSACTION_LOCK = "xxafmc_items_transactions_id_lock";
const BATCH_WISE_SUB_CATEGORIES = new Set([6, 7, 9, 10, 18]);

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

const isBatchWiseItem = (subCategory) => BATCH_WISE_SUB_CATEGORIES.has(Number(subCategory));

const normalizeTransactionDate = (value) => {
  const parsed = parseDate(value);
  return parsed ? parsed.toISOString().split("T")[0] : null;
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
           SUB_CATEGORY AS sub_category
    FROM xxafmc_inventory
    WHERE ITEM_CODE = ?
    LIMIT 1
  `;
  const [rows] = await executor.execute(sql, [Number(itemCode)]);
  return rows && rows.length ? rows[0] : null;
};

const parseVolumeToNumber = (volume) => {
  if (!volume) return null;
  const match = String(volume).match(/(\d+(\.\d+)?)/);
  return match ? Number(match[1]) : null;
};

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

const getBarLookupUnit = (subCategory, acUnit) => {
  const sub = Number(subCategory);
  const unit = String(acUnit || "").trim();

  if (sub === 9 && unit.toLowerCase() === "glass") return "glass";
  return unit;
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
        batchId,
        createdBy,
        acUnit,
        prepCharges,
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

      const barLookupUnit = getBarLookupUnit(inventoryItem.sub_category, effectiveAcUnit);
      const [barRows] = await connection.execute(
        "SELECT AC_QUANTITY AS ac_quantity, TYPE_ID AS type_id FROM xxafmc_bar WHERE TYPE = ? LIMIT 1",
        [barLookupUnit]
      );
      const barRow = barRows && barRows.length ? barRows[0] : null;

      const pegs = calculatePegs({
        subCategory: inventoryItem.sub_category,
        typeId: barRow?.type_id,
        volume,
        acQuantity: barRow?.ac_quantity,
      });
      const transactionPegs = isBatchWiseItem(inventoryItem.sub_category)
        ? numericQuantity
        : Math.round(Number(pegs || 0));

      const batchName = `${inventoryItem.item_name}-${numericQuantity}-${volume || ""}-${transactionDate}`;

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
          transactionPegs,
          createdBy || "SYSTEM",
          formatToSql(new Date()),
        ]
      );

      await connection.execute(
        `
          UPDATE xxafmc_inventory
          SET STOCK_QUANTITY = IFNULL(STOCK_QUANTITY, 0) + ?,
              UNIT_PRICE = ?,
              FLAG = COALESCE(?, FLAG)
          WHERE ITEM_CODE = ?
        `,
        [
          numericQuantity,
          Number(rate),
          prepCharges ? String(prepCharges).toUpperCase() : null,
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
};
