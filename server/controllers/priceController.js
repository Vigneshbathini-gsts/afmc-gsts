const db = require("../config/db");

// ==========================================
// Get Item Details By Barcode
// ==========================================
exports.getItemByBarcode = async (req, res) => {
  try {
    const { barcode } = req.params;

    if (!barcode) {
      return res.status(400).json({ message: "Barcode is required" });
    }

    // Step 1: Get item_code and rate from transactions table
    const [transactionRows] = await db.query(
      `SELECT item_code, rate
       FROM xxafmc_items_transactions
       WHERE barcode = ?
       AND flag = 'IN'`,
      [barcode]
    );

    if (transactionRows.length === 0) {
      return res.status(404).json({ message: "Item not found for this barcode" });
    }

    const transaction = transactionRows[0];
    const itemCode = transaction.item_code;
    const rate = transaction.rate;

    // Step 2: Get item_name from inventory table
    const [inventoryRows] = await db.query(
      `SELECT item_name
       FROM xxafmc_inventory
       WHERE item_code = ?`,
      [itemCode]
    );

    const itemName =
      inventoryRows.length > 0 ? inventoryRows[0].item_name : "";

    res.status(200).json({
      message: "Item fetched successfully",
      item: {
        barcode,
        itemCode,
        itemName,
        unitPrice: rate,
      },
    });
  } catch (err) {
    console.error("Get Item By Barcode Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ==========================================
// Update Item Price
// ==========================================
exports.updateItemPrice = async (req, res) => {
  try {
    const { barcode, unitPrice } = req.body;

    if (!barcode || !unitPrice) {
      return res.status(400).json({
        message: "Barcode and unit price are required",
      });
    }

    const [existingRows] = await db.query(
      `SELECT item_code
       FROM xxafmc_items_transactions
       WHERE barcode = ?
       AND flag = 'IN'`,
      [barcode]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ message: "Item not found for this barcode" });
    }

    await db.query(
      `UPDATE xxafmc_items_transactions
       SET rate = ?
       WHERE barcode = ?
       AND flag = 'IN'`,
      [unitPrice, barcode]
    );

    res.status(200).json({
      message: "Item price updated successfully",
    });
  } catch (err) {
    console.error("Update Item Price Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};