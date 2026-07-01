const addStockModel = require("../models/addStockModel");

exports.addStock = async (req, res) => {
  try {
    const payload = req.body?.items ? req.body.items : req.body;
    const result = await addStockModel.addStockTransactions(payload);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error("Error adding stock:", error);
    if (error.code === "DUPLICATE_BARCODE") {
      return res.status(409).json({ success: false, message: "Duplicate Barcode" });
    }
    if (error.code === "ITEM_NOT_FOUND") {
      return res.status(404).json({ success: false, message: "Item not found" });
    }
    if (error.code === "INVALID_DATA") {
      return res.status(400).json({ success: false, message: "Invalid data" });
    }
    res.status(500).json({ success: false, message: "Failed to add stock" });
  }
};
