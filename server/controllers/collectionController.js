const pool = require("../config/db");

/**
 * GET all collection items for an order
 */
exports.getCollectionByOrder = async (req, res) => {
  try {
    const { orderNumber } = req.params;

    if (!orderNumber) {
      return res.status(400).json({
        success: false,
        message: "Order number is required",
      });
    }

    const [rows] = await pool.query(
      `
      SELECT *
      FROM order_scan_collection
      WHERE collection_name = 'S_COLLECTION'
        AND order_number = ?
      ORDER BY id ASC
      `,
      [orderNumber]
    );

    return res.status(200).json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("Error fetching collection:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch collection",
      error: error.message,
    });
  }
};

/**
 * ADD item to collection (barcode scanned)
 */
exports.addToCollection = async (req, res) => {
  try {
    const {
      order_number,
      item_code,
      item_name,
      scan_quantity,
      item_price,
      barcode,
      inventory_item_code,
    } = req.body;

    if (!order_number || !item_code || !scan_quantity) {
      return res.status(400).json({
        success: false,
        message: "Order number, item code, and scan quantity are required",
      });
    }

    const [result] = await pool.query(
      `
      INSERT INTO order_scan_collection
        (collection_name, order_number, item_code, item_name, scan_quantity, item_price, barcode, inventory_item_code, extra_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        "S_COLLECTION",
        order_number,
        item_code,
        item_name || "",
        scan_quantity,
        item_price || null,
        barcode || null,
        inventory_item_code || null,
        null,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Item added to collection",
      data: {
        id: result.insertId,
      },
    });
  } catch (error) {
    console.error("Error adding to collection:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add to collection",
      error: error.message,
    });
  }
};

/**
 * UPDATE collection item quantity
 */
exports.updateCollectionItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { scan_quantity } = req.body;

    if (!id || scan_quantity === undefined) {
      return res.status(400).json({
        success: false,
        message: "Item ID and scan quantity are required",
      });
    }

    const [result] = await pool.query(
      `
      UPDATE order_scan_collection
      SET scan_quantity = ?
      WHERE id = ?
        AND collection_name = 'S_COLLECTION'
      `,
      [scan_quantity, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Collection item not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Item updated successfully",
    });
  } catch (error) {
    console.error("Error updating collection item:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update collection item",
      error: error.message,
    });
  }
};

/**
 * DELETE item from collection
 */
exports.deleteFromCollection = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Item ID is required",
      });
    }

    const [result] = await pool.query(
      `
      DELETE FROM order_scan_collection
      WHERE id = ?
        AND collection_name = 'S_COLLECTION'
      `,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Collection item not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Item deleted from collection",
    });
  } catch (error) {
    console.error("Error deleting from collection:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete from collection",
      error: error.message,
    });
  }
};

/**
 * CLEAR entire collection for an order
 */
exports.clearCollection = async (req, res) => {
  try {
    const { orderNumber } = req.params;

    if (!orderNumber) {
      return res.status(400).json({
        success: false,
        message: "Order number is required",
      });
    }

    const [result] = await pool.query(
      `
      DELETE FROM order_scan_collection
      WHERE collection_name = 'S_COLLECTION'
        AND order_number = ?
      `,
      [orderNumber]
    );

    return res.status(200).json({
      success: true,
      message: `Cleared ${result.affectedRows} items from collection`,
    });
  } catch (error) {
    console.error("Error clearing collection:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to clear collection",
      error: error.message,
    });
  }
};

/**
 * GET total scanned quantity for item in order
 */
exports.getScannedQuantityByItem = async (req, res) => {
  try {
    const { orderNumber, itemCode } = req.params;

    if (!orderNumber || !itemCode) {
      return res.status(400).json({
        success: false,
        message: "Order number and item code are required",
      });
    }

    const [rows] = await pool.query(
      `
      SELECT COALESCE(SUM(scan_quantity), 0) AS total_scanned
      FROM order_scan_collection
      WHERE collection_name = 'S_COLLECTION'
        AND order_number = ?
        AND item_code = ?
      `,
      [orderNumber, itemCode]
    );

    return res.status(200).json({
      success: true,
      data: {
        total_scanned: rows[0]?.total_scanned || 0,
      },
    });
  } catch (error) {
    console.error("Error fetching scanned quantity:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch scanned quantity",
      error: error.message,
    });
  }
};

/**
 * GET collection summary (totals by item)
 */
exports.getCollectionSummary = async (req, res) => {
  try {
    const { orderNumber } = req.params;

    if (!orderNumber) {
      return res.status(400).json({
        success: false,
        message: "Order number is required",
      });
    }

    const [rows] = await pool.query(
      `
      SELECT 
        item_code,
        item_name,
        SUM(scan_quantity) AS total_quantity,
        COUNT(DISTINCT barcode) AS barcode_count,
        item_price
      FROM order_scan_collection
      WHERE collection_name = 'S_COLLECTION'
        AND order_number = ?
      GROUP BY item_code, item_name, item_price
      ORDER BY item_code ASC
      `,
      [orderNumber]
    );

    const [totalRow] = await pool.query(
      `
      SELECT 
        COUNT(*) AS total_scans,
        SUM(scan_quantity) AS total_items,
        COUNT(DISTINCT barcode) AS unique_barcodes
      FROM order_scan_collection
      WHERE collection_name = 'S_COLLECTION'
        AND order_number = ?
      `,
      [orderNumber]
    );

    return res.status(200).json({
      success: true,
      data: {
        items: rows,
        summary: totalRow[0],
      },
    });
  } catch (error) {
    console.error("Error fetching collection summary:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch collection summary",
      error: error.message,
    });
  }
};
