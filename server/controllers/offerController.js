const db = require("../config/db");

const getOfferItemAvailability = async (itemCode) => {
  const [[row]] = await db.query(
    `
      SELECT
        IFNULL(SUM(STOCK_QUANTITY), 0) AS available_quantity
      FROM xxafmc_stock_out
      WHERE ITEM_CODE = ?
    `,
    [itemCode]
  );

  return row ? Number(row.available_quantity || 0) : 0;
};

// Get All Offers
exports.getAllOffers = async (req, res) => {
  try {
    const includeExpired = req.query.includeExpired === "true";
    const availabilityFilter = includeExpired
      ? ""
      : `WHERE (
          ofr.END_DATE IS NULL
          OR CURDATE() <= ofr.END_DATE
        )
        AND UPPER(IFNULL(ofr.STATUS, '')) <> 'INACTIVE'`;

    const [offers] = await db.query(`
      SELECT 
          ofr.OFFER_ID as offer_id,
          MAX(inv.item_name) as item_name,
          ofr.ITEM_CODE as item_code,
          ofr.OFFER_QUANTITY as offer_quantity,
          ofr.FREE_ITEM_CODE as free_item_code,
          MAX(freeinv.item_name) AS free_item,
          DATE_FORMAT(ofr.OFFER_DATE, '%Y-%m-%d') as offer_date,

          CASE 
            WHEN UPPER(IFNULL(ofr.STATUS, '')) = 'INACTIVE' THEN 'Inactive'
            WHEN CURDATE() < ofr.OFFER_DATE THEN 'Scheduled'
            WHEN ofr.END_DATE IS NULL AND CURDATE() >= ofr.OFFER_DATE THEN 'Active'
            WHEN CURDATE() BETWEEN ofr.OFFER_DATE AND ofr.END_DATE THEN 'Active'
            ELSE 'Inactive'
          END as status,

          ofr.MESSAGE as message,
          DATE_FORMAT(ofr.END_DATE, '%Y-%m-%d') as end_date,
          ofr.FREE_ITEM_QUANTITY as free_item_quantity

      FROM xxafmc_offers ofr
LEFT JOIN xxafmc_inventory inv 
  ON ofr.ITEM_CODE = inv.item_code
LEFT JOIN xxafmc_inventory freeinv 
  ON ofr.FREE_ITEM_CODE = freeinv.item_code
${availabilityFilter}
GROUP BY
    ofr.OFFER_ID, 
    ofr.ITEM_CODE, 
    ofr.FREE_ITEM_CODE, 
    ofr.OFFER_QUANTITY, 
    ofr.OFFER_DATE,
    ofr.MESSAGE, 
    ofr.END_DATE, 
    ofr.FREE_ITEM_QUANTITY
ORDER BY
  CASE
    WHEN UPPER(IFNULL(ofr.STATUS, '')) = 'INACTIVE' THEN 1
    WHEN CURDATE() < ofr.OFFER_DATE THEN 1
    WHEN ofr.END_DATE IS NULL OR CURDATE() <= ofr.END_DATE THEN 0
    ELSE 1
  END ASC,
  ofr.CREATION_DATE DESC,
  ofr.OFFER_ID DESC
    `);

    res.status(200).json({
      message: "Offers fetched successfully",
      offers,
    });

  } catch (err) {
    console.log("Get All Offers Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get Offer By ID
exports.getOfferById = async (req, res) => {
  try {
    const { id } = req.params;

    const [offers] = await db.query(
      `
      SELECT 
          ofr.OFFER_ID as offer_id,
          ofr.ITEM_CODE as item_code,
          inv.item_name,
          ofr.OFFER_QUANTITY as offer_quantity,
          ofr.FREE_ITEM_CODE as free_item_code,
          freeinv.item_name AS free_item,
          DATE_FORMAT(ofr.OFFER_DATE, '%Y-%m-%d') as offer_date,
          ofr.MESSAGE as message,
          ofr.FREE_ITEM_QUANTITY as free_item_quantity,
          CASE
            WHEN UPPER(IFNULL(ofr.STATUS, '')) = 'INACTIVE' THEN 'Inactive'
            WHEN CURDATE() < ofr.OFFER_DATE THEN 'Scheduled'
            WHEN ofr.END_DATE IS NULL OR CURDATE() <= ofr.END_DATE THEN 'Active'
            ELSE 'Inactive'
          END as status,
          DATE_FORMAT(ofr.END_DATE, '%Y-%m-%d') as end_date
      FROM xxafmc_offers ofr
      LEFT JOIN xxafmc_inventory inv 
        ON ofr.ITEM_CODE = inv.item_code
      LEFT JOIN xxafmc_inventory freeinv 
        ON ofr.FREE_ITEM_CODE = freeinv.item_code
      WHERE ofr.OFFER_ID = ?
      `,
      [id]
    );

    if (offers.length === 0) {
      return res.status(404).json({ message: "Offer not found" });
    }

    res.status(200).json({
      message: "Offer fetched successfully",
      offer: offers[0],
    });
  } catch (err) {
    console.log("Get Offer By ID Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Create Offer (end_date is now required)
exports.createOffer = async (req, res) => {
  try {
    const {
      item_code,
      offer_quantity,
      free_item_code,
      free_item_quantity,
      offer_date,
      end_date,
      message,
    } = req.body;

    const username = req.user?.username || "SYSTEM";
    

    // Validation - only required fields
    if (!item_code) {
      return res.status(400).json({ message: "Item code is required" });
    }
    if (!offer_quantity || offer_quantity <= 0) {
      return res.status(400).json({ message: "Valid offer quantity is required" });
    }
    if (!free_item_code) {
      return res.status(400).json({ message: "Free item code is required" });
    }
    if (!free_item_quantity || free_item_quantity <= 0) {
      return res.status(400).json({ message: "Valid free item quantity is required" });
    }
    if (!offer_date) {
      return res.status(400).json({ message: "Offer date is required" });
    }
    if (!end_date) {
      return res.status(400).json({ message: "End date is required" });
    }
    if (offer_date && end_date && end_date < offer_date) {
      return res.status(400).json({ message: "End date cannot be earlier than offer date" });
    }

    const itemAvailableQuantity = await getOfferItemAvailability(item_code);
    if (itemAvailableQuantity <= 0) {
      return res.status(400).json({ message: "Selected item has no stock" });
    }

    const freeItemAvailableQuantity = await getOfferItemAvailability(free_item_code);
    if (freeItemAvailableQuantity <= 0) {
      return res.status(400).json({ message: "Selected free item has no stock" });
    }

    // Get item names from inventory
    const [itemInfo] = await db.query(
      "SELECT item_name FROM xxafmc_inventory WHERE item_code = ?",
      [item_code]
    );
    
    const [freeItemInfo] = await db.query(
      "SELECT item_name FROM xxafmc_inventory WHERE item_code = ?",
      [free_item_code]
    );

    const itemName = itemInfo[0]?.item_name || null;
    const freeItemName = freeItemInfo[0]?.item_name || null;

    // Insert - OFFER_ID auto-generated, STATUS will be calculated dynamically
    const [result] = await db.query(
      `INSERT INTO xxafmc_offers (
          ITEM_CODE,
          ITEM_NAME,
          OFFER_QUANTITY,
          FREE_ITEM_CODE,
          FREE_ITEM,
          FREE_ITEM_QUANTITY,
          OFFER_DATE,
          END_DATE,
          MESSAGE,
          CREATED_BY,
          CREATION_DATE,
          LAST_UPDATED_BY,
          LAST_UPDATED_DATE
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, NOW())`,
      [
        item_code,
        itemName,
        offer_quantity,
        free_item_code,
        freeItemName,
        free_item_quantity,
        offer_date,
        end_date,
        message || null,
        username,
        username
      ]
    );


    res.status(201).json({
      message: "Offer created successfully",
      offer_id: result.insertId
    });

  } catch (err) {
    console.log("Create Offer Error:", err);
    res.status(500).json({ 
      message: "Internal server error",
      error: err.message 
    });
  }
};

exports.updateOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const username = req.user?.username || "SYSTEM";
    const { endDate, status } = req.body;

    // console.log("Updating Offer - ID:", id, "EndDate:", endDate);

    if (!endDate || !status) {
      return res.status(400).json({ message: "End date and status are required" });
    }

    const normalizedStatus = String(status).trim().toUpperCase();
    if (!['ACTIVE', 'INACTIVE'].includes(normalizedStatus)) {
      return res.status(400).json({ message: "Invalid offer status" });
    }

    // Check if offer exists
    const [existing] = await db.query(
      "SELECT OFFER_ID FROM xxafmc_offers WHERE OFFER_ID = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ message: "Offer not found" });
    }

    const [currentOffer] = await db.query(
      "SELECT STATUS, DATE_FORMAT(OFFER_DATE, '%Y-%m-%d') AS OFFER_DATE FROM xxafmc_offers WHERE OFFER_ID = ?",
      [id]
    );

    if (String(currentOffer[0].STATUS || '').toUpperCase() === 'INACTIVE' && normalizedStatus === 'ACTIVE') {
      return res.status(400).json({ message: "Inactive offers cannot be activated again" });
    }

    if (currentOffer[0].OFFER_DATE && endDate < currentOffer[0].OFFER_DATE) {
      return res.status(400).json({ message: "End date cannot be earlier than start date" });
    }

    await db.query(
      `UPDATE xxafmc_offers 
       SET END_DATE = ?,
           STATUS = ?,
           LAST_UPDATED_BY = ?,
           LAST_UPDATED_DATE = NOW()
       WHERE OFFER_ID = ?`,
      [endDate, normalizedStatus === 'INACTIVE' ? 'Inactive' : 'Active', username, id]
    );

    res.status(200).json({
      message: "Offer updated successfully",
      offer_id: id,
      end_date: endDate
    });

  } catch (err) {
    console.log("Update Offer Error:", err);
    res.status(500).json({ 
      message: "Internal server error",
      error: err.message 
    });
  }
};

// Get All Items for Offer Dropdown
exports.getAllItemsForOffer = async (req, res) => {
  try {
    const [items] = await db.query(`
      SELECT
        xi.ITEM_CODE AS item_code,
        TRIM(xi.ITEM_NAME) AS item_name,
        IFNULL(stock_summary.stock_quantity, 0) AS available_quantity
      FROM xxafmc_inventory xi
      INNER JOIN (
        SELECT ITEM_CODE, IFNULL(SUM(STOCK_QUANTITY), 0) AS stock_quantity
        FROM xxafmc_stock_out
        GROUP BY ITEM_CODE
      ) stock_summary
        ON stock_summary.ITEM_CODE = xi.ITEM_CODE
      WHERE TRIM(IFNULL(xi.ITEM_NAME, '')) <> ''
        AND xi.SUB_CATEGORY NOT IN (14, 15)
      GROUP BY
        xi.ITEM_CODE,
        xi.ITEM_NAME,
        stock_summary.stock_quantity
      HAVING available_quantity > 0
      ORDER BY item_name
    `);

    res.status(200).json({
      message: "Items fetched successfully",
      items,
    });
  } catch (err) {
    console.log("Get Items For Offer Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

