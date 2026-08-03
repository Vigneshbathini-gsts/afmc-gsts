const addStockModel = require("../models/addStockModel");

exports.getNextBatchId = async (req, res) => {
  try {
    const { itemCode, transactionDate } = req.query;
    if (!itemCode || !transactionDate) {
      return res.status(400).json({
        success: false,
        message: "Item code and transaction date are required",
      });
    }
    const batchId = await addStockModel.getNextBatchId({ itemCode, transactionDate });
    res.status(200).json({ success: true, data: { batchId } });
  } catch (error) {
    console.error("Error generating batch ID:", error);
    if (error.code === "ITEM_NOT_FOUND") {
      return res.status(404).json({ success: false, message: "Item not found" });
    }
    res.status(500).json({ success: false, message: "Failed to generate batch ID" });
  }
};

exports.addStock = async (req, res) => {
  try {
    const payload = req.body?.items ? req.body.items : req.body;
    const createdBy =
      req.user?.username ||
      req.user?.user_name ||
      req.user?.email ||
      "SYSTEM";

    const normalizedPayload = Array.isArray(payload)
      ? payload.map((item) => ({ ...item, createdBy: item?.createdBy || createdBy }))
      : { ...payload, createdBy: payload?.createdBy || createdBy };

    const result = await addStockModel.addStockTransactions(normalizedPayload);
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
    if (error.code === "INVALID_SINGLE_QUANTITY") {
      return res.status(400).json({
        success: false,
        message: "Quantity must be 1 for this item group",
      });
    }
    res.status(500).json({ success: false, message: "Failed to add stock" });
  }
};
