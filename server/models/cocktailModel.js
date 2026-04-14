const db = require("../config/db");

const DETAIL_TABLE = "xxafmc_cocktails_mocktails_details";
const AFMC_IMAGE_PUBLIC_BASE_URL = (
  process.env.AFMC_IMAGE_PUBLIC_BASE_URL ||
  "https://afmc.globalsparkteksolutions.com/AFMCIMAGES"
).replace(/\/+$/, "");

const normalizeText = (value) => {
  if (value == null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized === "" ? null : normalized;
};

const normalizeNumber = (value, { integer = false } = {}) => {
  if (value == null || value === "") {
    return null;
  }

  const numericValue = integer ? parseInt(value, 10) : Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const normalizeSubCategory = (value) => {
  const subCategory = normalizeNumber(value, { integer: true });
  return subCategory === 14 || subCategory === 15 ? subCategory : null;
};

const normalizeRows = (rows) => {
  let parsedRows = rows;

  if (typeof parsedRows === "string") {
    parsedRows = JSON.parse(parsedRows);
  }

  if (!Array.isArray(parsedRows)) {
    throw new Error("Rows data must be an array");
  }

  return parsedRows
    .map((row) => ({
      itemCode: normalizeNumber(row.itemCode, { integer: true }),
      itemName: normalizeText(row.itemName),
      pegs: normalizeNumber(row.pegs, { integer: true }),
      memberPrice: normalizeNumber(row.memberPrice),
      nonMemberPrice: normalizeNumber(row.nonMemberPrice),
    }))
    .filter(
      (row) =>
        row.itemCode != null ||
        row.itemName != null ||
        row.pegs != null ||
        row.memberPrice != null ||
        row.nonMemberPrice != null
    );
};

const validatePayload = (payload) => {
  const itemName = normalizeText(payload.itemName);
  const description = normalizeText(payload.description);
  const subCategory = normalizeSubCategory(payload.subCategory);
  const memberProfit = normalizeNumber(payload.memberProfit, { integer: true });
  const memberPrCharges = normalizeNumber(payload.memberPrCharges);
  const nonMemberProfit = normalizeNumber(payload.nonMemberProfit, {
    integer: true,
  });
  const nonMemberPrCharges = normalizeNumber(payload.nonMemberPrCharges);
  const rows = normalizeRows(payload.rows);

  if (!itemName) {
    throw new Error("Item name is required");
  }

  if (!subCategory) {
    throw new Error("Valid sub category is required");
  }

  if (!rows.length) {
    throw new Error("At least one cocktail detail row is required");
  }

  const invalidRow = rows.find(
    (row) =>
      row.itemCode == null ||
      !row.itemName ||
      row.memberPrice == null ||
      row.nonMemberPrice == null
  );

  if (invalidRow) {
    throw new Error(
      "Each row must include item code, item name, member price, and non member price"
    );
  }

  return {
    itemName,
    description,
    subCategory,
    memberProfit,
    memberPrCharges,
    nonMemberProfit,
    nonMemberPrCharges,
    rows,
  };
};

const getCocktailItems = async (search = "") => {
  const normalizedSearch =
    typeof search === "string" && search.trim() !== "" ? search.trim() : null;

  const query = `
    SELECT
      ITEM_ID,
      ITEM_NAME,
      DESCRIPTION,
      ITEM_CODE,
      CATEGORY_ID,
      SUB_CATEGORY,
      UNIT_PRICE,
      FOOD_PR_CHARGES,
      CASE
        WHEN SUB_CATEGORY = 14 THEN 'COCKTAIL'
        WHEN SUB_CATEGORY = 15 THEN 'MOCKTAIL'
        ELSE 'UNKNOWN'
      END AS CATEGORY_NAME,
      CASE
        WHEN IFNULL(TRIM(IMAGE), '') = '' THEN NULL
        WHEN IMAGE LIKE 'http%' THEN IMAGE
        WHEN IMAGE LIKE '/uploads/%' THEN IMAGE
        ELSE CONCAT('/apex_image_endpoint?item_id=', ITEM_ID)
      END AS IMAGE_URL
    FROM xxafmc_inventory
    WHERE SUB_CATEGORY IN (14, 15)
      AND (
        ? IS NULL
        OR UPPER(ITEM_NAME) LIKE CONCAT('%', UPPER(?), '%')
        OR CAST(ITEM_CODE AS CHAR) LIKE CONCAT('%', ?, '%')
      )
    ORDER BY ITEM_ID DESC
  `;

  const [rows] = await db.execute(query, [
    normalizedSearch,
    normalizedSearch,
    normalizedSearch,
  ]);

  return rows;
};

const getCocktailIngredientOptions = async (search = "") => {
  const normalizedSearch =
    typeof search === "string" && search.trim() !== "" ? search.trim() : null;

  const query = `
    SELECT DISTINCT
      ITEM_CODE,
      ITEM_NAME
    FROM xxafmc_inventory
    WHERE ITEM_CODE IS NOT NULL
      AND ITEM_NAME IS NOT NULL
      AND TRIM(ITEM_NAME) <> ''
      AND (SUB_CATEGORY IS NULL OR SUB_CATEGORY NOT IN (14, 15))
      AND (
        ? IS NULL
        OR UPPER(ITEM_NAME) LIKE CONCAT('%', UPPER(?), '%')
        OR CAST(ITEM_CODE AS CHAR) LIKE CONCAT('%', ?, '%')
      )
    ORDER BY ITEM_NAME ASC, ITEM_CODE ASC
    LIMIT 200
  `;

  const [rows] = await db.execute(query, [
    normalizedSearch,
    normalizedSearch,
    normalizedSearch,
  ]);

  return rows;
};

const getCocktailIngredientPricing = async (itemCode, pegs) => {
  const normalizedItemCode = normalizeNumber(itemCode, { integer: true });
  const normalizedPegs = normalizeNumber(pegs);

  if (!normalizedItemCode) {
    throw new Error("Valid item code is required");
  }

  const [rows] = await db.execute(
    `
      SELECT
        inv.ITEM_CODE,
        inv.ITEM_NAME,
        inv.UNIT_PRICE,
        inv.PROFIT,
        inv.NON_MEMBER_PROFIT,
        recent_price.UNIT_PRICE AS STOCK_UNIT_PRICE,
        recent_price.PEGS AS STOCK_PEGS
      FROM xxafmc_inventory inv
      LEFT JOIN (
        SELECT UNIT_PRICE, PEGS, ITEM_CODE
        FROM xxafmc_stock_out
        WHERE ITEM_CODE = ?
          AND stock_quantity > 0
          AND UNIT_PRICE = (
            SELECT MAX(UNIT_PRICE)
            FROM xxafmc_stock_out
            WHERE ITEM_CODE = ?
              AND stock_quantity > 0
          )
        ORDER BY CREATION_DATE DESC
        LIMIT 1
      ) recent_price
        ON recent_price.ITEM_CODE = inv.ITEM_CODE
      WHERE inv.ITEM_CODE = ?
      LIMIT 1
    `,
    [normalizedItemCode, normalizedItemCode, normalizedItemCode]
  );

  const item = rows[0];

  if (!item) {
    throw new Error("Ingredient item not found");
  }

  if (normalizedPegs == null || normalizedPegs <= 0) {
    return {
      itemCode: normalizedItemCode,
      itemName: item.ITEM_NAME,
      pegs: normalizedPegs,
      memberPrice: null,
      nonMemberPrice: null,
    };
  }

  const unitPrice =
    normalizeNumber(item.STOCK_UNIT_PRICE) ?? normalizeNumber(item.UNIT_PRICE) ?? 0;
  const stockPegs = normalizeNumber(item.STOCK_PEGS) || 1;
  const memberProfit = normalizeNumber(item.PROFIT) || 0;
  const nonMemberProfit = normalizeNumber(item.NON_MEMBER_PROFIT) || 0;
  const basePegPrice = unitPrice / (stockPegs === 0 ? 1 : stockPegs);
  const memberPrice = Number(
    (basePegPrice + (basePegPrice * memberProfit) / 100) * normalizedPegs
  );
  const nonMemberPrice = Number(
    (basePegPrice + (basePegPrice * nonMemberProfit) / 100) * normalizedPegs
  );

  return {
    itemCode: normalizedItemCode,
    itemName: item.ITEM_NAME,
    pegs: normalizedPegs,
    memberPrice: Number(memberPrice.toFixed(2)),
    nonMemberPrice: Number(nonMemberPrice.toFixed(2)),
  };
};

const getCocktailDetailRows = async (inventoryItemCode, connection = db) => {
  const query = `
    SELECT
      MOC_ID,
      ITEM_CODE,
      ITEM_NAME,
      PRICE,
      PEGS,
      INVENTORY_ITEM_CODE,
      NON_MEMBER_PRICE,
      CATEGORY_ID,
      SUBCATEGORY_ID
    FROM ${DETAIL_TABLE}
    WHERE INVENTORY_ITEM_CODE = ?
    ORDER BY COALESCE(MOC_ID, 0), ITEM_NAME
  `;

  const [rows] = await connection.execute(query, [inventoryItemCode]);
  return rows;
};

const getCocktailItemById = async (itemId) => {
  const query = `
    SELECT
      ITEM_ID,
      STOCK_QUANTITY,
      ITEM_NAME,
      UNIT_PRICE,
      DESCRIPTION,
      CATEGORY_ID,
      ITEM_CODE,
      IMAGE,
      MIME_TYPE,
      FILE_NAME,
      PEGS,
      \`A/C_UNIT\`,
      SUB_CATEGORY,
      FOOD_PR_CHARGES,
      PROFIT,
      NON_MEMBER_PROFIT,
      PR_CHARGES,
      CREATED_BY,
      CREATION_DATE,
      LAST_UPDATED_BY,
      LAST_UPDATE_DATE
    FROM xxafmc_inventory
    WHERE ITEM_ID = ?
      AND SUB_CATEGORY IN (14, 15)
  `;

  const [rows] = await db.execute(query, [itemId]);
  const item = rows[0] || null;

  if (!item) {
    return null;
  }

  const details = await getCocktailDetailRows(item.ITEM_CODE || item.ITEM_ID);

  return {
    ...item,
    details,
  };
};

const insertDetailRows = async (connection, inventoryItemCode, subCategory, rows, userName) => {
  const [[maxRow]] = await connection.execute(
    `SELECT COALESCE(MAX(MOC_ID), 0) AS maxId FROM ${DETAIL_TABLE}`
  );

  let nextDetailId = Number(maxRow?.maxId || 0);

  for (const row of rows) {
    nextDetailId += 1;

    await connection.execute(
      `
        INSERT INTO ${DETAIL_TABLE} (
          MOC_ID,
          ITEM_CODE,
          ITEM_NAME,
          PRICE,
          PEGS,
          INVENTORY_ITEM_CODE,
          NON_MEMBER_PRICE,
          CREATED_BY,
          CREATION_DATE,
          LAST_UPDATED_BY,
          LAST_UPDATED_LOGIN,
          LAST_UPDATED_DATE,
          CATEGORY_ID,
          SUBCATEGORY_ID
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, NOW(), 10, ?)
      `,
      [
        nextDetailId,
        row.itemCode,
        row.itemName,
        row.memberPrice,
        row.pegs,
        inventoryItemCode,
        row.nonMemberPrice,
        userName,
        userName,
        userName,
        subCategory,
      ]
    );
  }
};

const syncInventoryUnitPrice = async (connection, inventoryItemCode) => {
  const [[sumRow]] = await connection.execute(
    `SELECT COALESCE(SUM(PRICE), 0) AS totalPrice FROM ${DETAIL_TABLE} WHERE INVENTORY_ITEM_CODE = ?`,
    [inventoryItemCode]
  );

  await connection.execute(
    `UPDATE xxafmc_inventory SET UNIT_PRICE = ? WHERE ITEM_CODE = ?`,
    [sumRow.totalPrice, inventoryItemCode]
  );

  return sumRow.totalPrice;
};

const createCocktailItem = async (payload, options = {}) => {
  const data = validatePayload(payload);
  const userName = normalizeText(options.userName) || "SYSTEM";
  const imagePath = options.imageFile
    ? `${AFMC_IMAGE_PUBLIC_BASE_URL}/${options.imageFile.filename}`
    : null;
  const fileName = options.imageFile?.originalname || null;
  const mimeType = options.imageFile?.mimetype || null;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [[nextInventoryRow]] = await connection.execute(
      `
        SELECT COALESCE(
          GREATEST(
            COALESCE(MAX(ITEM_ID), 0),
            COALESCE(MAX(ITEM_CODE), 0)
          ),
          0
        ) + 1 AS nextItemId
        FROM xxafmc_inventory
      `
    );

    const itemId = Number(nextInventoryRow?.nextItemId || 0);

    if (!itemId) {
      throw new Error("Unable to generate inventory item id");
    }

    await connection.execute(
      `
        INSERT INTO xxafmc_inventory (
          ITEM_ID,
          ITEM_NAME,
          DESCRIPTION,
          CATEGORY_ID,
          SUB_CATEGORY,
          ITEM_CODE,
          \`A/C_UNIT\`,
          PROFIT,
          FOOD_PR_CHARGES,
          NON_MEMBER_PROFIT,
          PR_CHARGES,
          CREATION_DATE,
          CREATED_BY,
          IMAGE,
          FILE_NAME,
          MIME_TYPE
        )
        VALUES (?, ?, ?, 10, ?, ?, 'Nos', ?, ?, ?, ?, NOW(), ?, ?, ?, ?)
      `,
      [
        itemId,
        data.itemName,
        data.description,
        data.subCategory,
        itemId,
        data.memberProfit,
        data.memberPrCharges,
        data.nonMemberProfit,
        data.nonMemberPrCharges,
        userName,
        imagePath,
        fileName,
        mimeType,
      ]
    );

    await connection.execute(
      `UPDATE xxafmc_inventory SET ITEM_CODE = ? WHERE ITEM_ID = ?`,
      [itemId, itemId]
    );

    await insertDetailRows(
      connection,
      itemId,
      data.subCategory,
      data.rows,
      userName
    );

    const unitPrice = await syncInventoryUnitPrice(connection, itemId);

    await connection.commit();

    return {
      itemId,
      itemCode: itemId,
      unitPrice,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updateCocktailItem = async (itemId, payload, options = {}) => {
  const data = validatePayload(payload);
  const userName = normalizeText(options.userName) || "SYSTEM";
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [[existingItem]] = await connection.execute(
      `
        SELECT ITEM_ID, ITEM_CODE, IMAGE, FILE_NAME, MIME_TYPE
        FROM xxafmc_inventory
        WHERE ITEM_ID = ?
          AND SUB_CATEGORY IN (14, 15)
        LIMIT 1
      `,
      [itemId]
    );

    if (!existingItem) {
      throw new Error("Cocktail item not found");
    }

    const inventoryItemCode = Number(existingItem.ITEM_CODE || existingItem.ITEM_ID);
    const imagePath = options.imageFile
      ? `${AFMC_IMAGE_PUBLIC_BASE_URL}/${options.imageFile.filename}`
      : existingItem.IMAGE;
    const fileName = options.imageFile?.originalname || existingItem.FILE_NAME;
    const mimeType = options.imageFile?.mimetype || existingItem.MIME_TYPE;

    await connection.execute(
      `
        UPDATE xxafmc_inventory
        SET ITEM_NAME = ?,
            DESCRIPTION = ?,
            CATEGORY_ID = 10,
            SUB_CATEGORY = ?,
            \`A/C_UNIT\` = 'Nos',
            PROFIT = ?,
            FOOD_PR_CHARGES = ?,
            NON_MEMBER_PROFIT = ?,
            PR_CHARGES = ?,
            IMAGE = ?,
            FILE_NAME = ?,
            MIME_TYPE = ?,
            LAST_UPDATE_DATE = NOW(),
            LAST_UPDATED_BY = ?
        WHERE ITEM_ID = ?
      `,
      [
        data.itemName,
        data.description,
        data.subCategory,
        data.memberProfit,
        data.memberPrCharges,
        data.nonMemberProfit,
        data.nonMemberPrCharges,
        imagePath,
        fileName,
        mimeType,
        userName,
        itemId,
      ]
    );

    await connection.execute(
      `DELETE FROM ${DETAIL_TABLE} WHERE INVENTORY_ITEM_CODE = ?`,
      [inventoryItemCode]
    );

    await insertDetailRows(
      connection,
      inventoryItemCode,
      data.subCategory,
      data.rows,
      userName
    );

    const unitPrice = await syncInventoryUnitPrice(connection, inventoryItemCode);

    await connection.commit();

    return {
      itemId: Number(itemId),
      itemCode: inventoryItemCode,
      unitPrice,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  getCocktailItems,
  getCocktailIngredientOptions,
  getCocktailIngredientPricing,
  getCocktailItemById,
  createCocktailItem,
  updateCocktailItem,
};
