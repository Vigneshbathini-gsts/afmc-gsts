const db = require("../config/db");

// Get All Offers
exports.getAllOffers = async (req, res) => {
  try {
    const [offers] = await db.query(`
      SELECT 
          ofr.OFFER_ID as offer_id,
          inv.item_name,
          ofr.ITEM_CODE as item_code,
          ofr.OFFER_QUANTITY as offer_quantity,
          ofr.FREE_ITEM_CODE as free_item_code,
          freeinv.item_name AS free_item,
          DATE_FORMAT(ofr.OFFER_DATE, '%Y-%m-%d') as offer_date,
          ofr.STATUS as status,
          ofr.MESSAGE as message,
          DATE_FORMAT(ofr.END_DATE, '%Y-%m-%d') as end_date,
          ofr.FREE_ITEM_QUANTITY as free_item_quantity
      FROM xxafmc_offers ofr
      LEFT JOIN xxafmc_inventory inv 
        ON ofr.ITEM_CODE = inv.item_code
      LEFT JOIN xxafmc_inventory freeinv 
        ON ofr.FREE_ITEM_CODE = freeinv.item_code
      ORDER BY ofr.OFFER_ID DESC
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
          ofr.STATUS as status,
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

// Create Offer (No end_date required, status defaults to 'Active')
exports.createOffer = async (req, res) => {
  try {
    const {
      item_code,
      offer_quantity,
      free_item_code,
      free_item_quantity,
      offer_date,
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

    // Insert - OFFER_ID auto-generated, STATUS defaults to 'Active', END_DATE not required
    const [result] = await db.query(
      `INSERT INTO xxafmc_offers (
          ITEM_CODE,
          ITEM_NAME,
          OFFER_QUANTITY,
          FREE_ITEM_CODE,
          FREE_ITEM,
          FREE_ITEM_QUANTITY,
          OFFER_DATE,
          MESSAGE,
          STATUS,
          CREATED_BY,
          CREATION_DATE,
          LAST_UPDATED_BY,
          LAST_UPDATED_DATE
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, NOW(), ?, NOW())`,
      [
        item_code,
        itemName,
        offer_quantity,
        free_item_code,
        freeItemName,
        free_item_quantity,
        offer_date,
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

// Update Offer - Always set end_date to current date, Status to 'Inactive'
exports.updateOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const username = req.user?.username || "SYSTEM";

    console.log("Deactivating Offer - ID:", id);
    
    // Always use current date
    const today = new Date();
    const end_date = today.toISOString().split('T')[0];
    
    console.log("Setting end date to:", end_date);

    // Check if offer exists
    const [existing] = await db.query(
      "SELECT OFFER_ID FROM xxafmc_offers WHERE OFFER_ID = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ message: "Offer not found" });
    }

    // Update end_date with current date and set status to 'Inactive'
    await db.query(
      `UPDATE xxafmc_offers 
       SET END_DATE = ?,
           STATUS = 'Inactive',
           LAST_UPDATED_BY = ?,
           LAST_UPDATED_DATE = NOW()
       WHERE OFFER_ID = ?`,
      [end_date, username, id]
    );

    res.status(200).json({
      message: "Offer deactivated successfully",
      offer_id: id,
      end_date: end_date,
      status: "Inactive"
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
      SELECT item_code, item_name FROM xxafmc_inventory ORDER BY item_name
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