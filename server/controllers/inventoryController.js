const inventoryModel = require("../models/inventoryModel");
const fs = require("fs");
const path = require("path");

exports.getInventory = async (req, res) => {
  try {
    const { categoryId, itemCode, q } = req.query;
    const items = await inventoryModel.getInventoryList({
      categoryId,
      itemCode,
      search: q,
    });
    res.status(200).json({ success: true, data: items });
  } catch (error) {
    console.error("Error fetching inventory:", error);
    res.status(500).json({ success: false, message: "Failed to load inventory" });
  }
};

exports.getCategories = async (_req, res) => {
  try {
    const categories = await inventoryModel.getCategories();
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ success: false, message: "Failed to load categories" });
  }
};

exports.getItems = async (req, res) => {
  try {
    const { categoryId } = req.query;
    const items = await inventoryModel.getItems(categoryId);
    res.status(200).json({ success: true, data: items });
  } catch (error) {
    console.error("Error fetching items:", error);
    res.status(500).json({ success: false, message: "Failed to load items" });
  }
};

exports.getSubCategories = async (req, res) => {
  try {
    const { categoryId } = req.query;
    const subCategories = await inventoryModel.getSubCategories(categoryId);
    res.status(200).json({ success: true, data: subCategories });
  } catch (error) {
    console.error("Error fetching sub-categories:", error);
    res.status(500).json({ success: false, message: "Failed to load sub-categories" });
  }
};

exports.createItem = async (req, res) => {
  try {
    const {
      itemName,
      description,
      categoryId,
      subCategory,
      acUnit,
      prepCharges,
      createdBy,
    } = req.body;

    if (!itemName || !categoryId) {
      return res.status(400).json({
        success: false,
        message: "Item name and category are required",
      });
    }

    const file = req.file;

    const newItem = await inventoryModel.createItem({
      itemName,
      description,
      categoryId,
      subCategory,
      acUnit,
      prepCharges,
      createdBy,
      fileName: file?.filename,
      mimeType: file?.mimetype,
    });

    res.status(201).json({ success: true, data: newItem });
  } catch (error) {
    console.error("Error creating item:", error);
    res.status(500).json({ success: false, message: "Failed to create item" });
  }
};

exports.getBarTypes = async (_req, res) => {
  try {
    const barTypes = await inventoryModel.getBarTypes();
    res.status(200).json({ success: true, data: barTypes });
  } catch (error) {
    console.error("Error fetching bar types:", error);
    res.status(500).json({ success: false, message: "Failed to load bar types" });
  }
};

exports.addStock = async (req, res) => {
  try {
    const payload = req.body?.items ? req.body.items : req.body;
    const result = await inventoryModel.addStockTransactions(payload);
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

exports.getStockOutItemByBarcode = async (req, res) => {
  try {
    const { barcode } = req.params;

    if (!barcode) {
      return res.status(400).json({ success: false, message: "Barcode is required" });
    }

    const item = await inventoryModel.getStockOutItemByBarcode(barcode);
    if (!item) {
      return res.status(404).json({ success: false, message: "Item not found for this barcode" });
    }

    res.status(200).json({ success: true, data: item });
  } catch (error) {
    console.error("Error fetching stock-out item by barcode:", error);
    res.status(500).json({ success: false, message: "Failed to fetch item" });
  }
};

exports.addStockOut = async (req, res) => {
  try {
    const payload = Array.isArray(req.body?.items) ? req.body.items : [];
    const result = await inventoryModel.addStockOutTransactions(payload);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error("Error creating stock-out transactions:", error);
    if (error.code === "ITEM_NOT_FOUND") {
      return res.status(404).json({ success: false, message: "Item not found" });
    }
    if (error.code === "INVALID_DATA") {
      return res.status(400).json({ success: false, message: "Invalid stock-out data" });
    }
    if (error.code === "INSUFFICIENT_STOCK") {
      return res.status(409).json({ success: false, message: "Insufficient stock" });
    }
    res.status(500).json({ success: false, message: "Failed to create stock-out transactions" });
  }
};

exports.updateItemImage = async (req, res) => {
  try {
    const { itemCode } = req.params;
    if (!itemCode) {
      return res.status(400).json({ success: false, message: "Item code is required" });
    }

    const file = req.file;
    if (!file) {
      return res
        .status(400)
        .json({ success: false, message: "Image file is required" });
    }

    const existing = await inventoryModel.getItemImageInfo(itemCode);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    const affected = await inventoryModel.updateItemImage({
      itemCode,
      fileName: file.filename,
      mimeType: file.mimetype,
    });

    if (affected === 0) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    if (existing.file_name) {
      const filePath = path.join(__dirname, "..", "uploads", existing.file_name);
      fs.promises.unlink(filePath).catch(() => {});
    }

    res.status(200).json({ success: true, data: { itemCode, fileName: file.filename } });
  } catch (error) {
    console.error("Error updating item image:", error);
    res.status(500).json({ success: false, message: "Failed to update image" });
  }
};

exports.getStockInReport = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    const rows = await inventoryModel.getStockInReport({ fromDate, toDate });
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("Error fetching stock-in report:", error);
    res.status(500).json({ success: false, message: "Failed to load stock-in report" });
  }
};

exports.getStockOutReport = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    const rows = await inventoryModel.getStockOutReport({ fromDate, toDate });
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("Error fetching stock-out report:", error);
    res.status(500).json({ success: false, message: "Failed to load stock-out report" });
  }
};
