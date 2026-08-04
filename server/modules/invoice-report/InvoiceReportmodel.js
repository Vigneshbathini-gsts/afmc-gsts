const db = require("../../config/db");

const createValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};



async function getInvoiceReportByOrderNumber(orderNumber) {
  const normalizedOrderNumber = Number(orderNumber);
  if (!Number.isFinite(normalizedOrderNumber) || normalizedOrderNumber <= 0) {
    throw createValidationError("Valid order number is required");
  }

  const [detailRows] = await db.execute(
    `
      SELECT
        od.order_line_id,
        od.order_id,
        od.item_id,
        COALESCE(xi.item_name, od.item_id) AS item_name,
        od.quantity,
        od.order_status AS order_status,
        od.subcategory,
        od.food_pr_charges,
        ROUND(
          CASE
            WHEN TRIM(UPPER(IFNULL(od.order_status, ''))) = 'CANCELLED' THEN 0
            -- For cocktails (subcategory 14 or 15), use subtotal from order_details directly
            -- DO NOT add food_pr_charges again because it's already included
            WHEN od.subcategory IN (14, 15) THEN IFNULL(od.subtotal, 0)
            WHEN scanned_totals.scanned_total > 0 AND (od.price IS NULL OR od.price <> 0) THEN scanned_totals.scanned_total
            WHEN custom_totals.unit_custom_total > 0 THEN custom_totals.unit_custom_total * od.quantity
            ELSE IFNULL(od.subtotal, 0)
          END,
          2
        ) AS subtotal,
        ROUND(
          CASE
            WHEN TRIM(UPPER(IFNULL(od.order_status, ''))) = 'CANCELLED' THEN 0
            -- For cocktails (subcategory 14 or 15), calculate price from subtotal directly
            -- FIX: Use NULLIF(od.quantity, 0) instead of NULLIF(od.quantity, 1)
            WHEN od.subcategory IN (14, 15) THEN 
              ROUND(IFNULL(od.subtotal, 0) / NULLIF(od.quantity, 0), 2)
            WHEN scanned_totals.scanned_total > 0 AND (od.price IS NULL OR od.price <> 0) THEN 
              ROUND(scanned_totals.scanned_total / NULLIF(od.quantity, 0), 2)
            WHEN custom_totals.unit_custom_total > 0 THEN custom_totals.unit_custom_total
            ELSE COALESCE(od.price, ROUND(od.subtotal / NULLIF(od.quantity, 0), 2), 0)
          END,
          2
        ) AS price,
        od.created_by,
        od.creation_date,
        od.last_updated_date,
        od.last_updated_by
      FROM xxafmc_order_details od
      LEFT JOIN (
        SELECT
          order_number,
          inventory_item_code,
          order_line_id,
          ROUND(SUM(IFNULL(scan_quantity, 0) * IFNULL(item_price, 0)), 2) AS scanned_total
        FROM order_scan_collection
        WHERE collection_name = 'S_COLLECTION'
        GROUP BY order_number, inventory_item_code, order_line_id
      ) scanned_totals
        ON scanned_totals.order_number = od.order_id
        AND scanned_totals.inventory_item_code = od.item_id
        AND (scanned_totals.order_line_id = od.order_line_id OR scanned_totals.order_line_id IS NULL)
      LEFT JOIN (
        SELECT
          cm.order_number,
          cm.inventory_item_code,
          ROUND(SUM(
            IFNULL(cm.pegs, 0) *
            (
              IFNULL(stock_prices.base_peg_price, 0) * (1 + IFNULL(od_price.profit, 0) / 100) +
              IFNULL(od_price.food_pr_charges, 0)
            )
          ), 2) AS unit_custom_total
        FROM xxafmc_custom_cocktails_mocktails_details cm
        JOIN xxafmc_order_details od_price
          ON od_price.order_id = cm.order_number
          AND od_price.item_id = cm.inventory_item_code
        LEFT JOIN (
          SELECT
            item_code,
            MAX(IFNULL(unit_price, 0) / IFNULL(NULLIF(pegs, 0), 1)) AS base_peg_price
          FROM xxafmc_stock_out
          WHERE IFNULL(stock_quantity, 0) > 0
          GROUP BY item_code
        ) stock_prices
          ON stock_prices.item_code = cm.item_code
        GROUP BY cm.order_number, cm.inventory_item_code
      ) custom_totals
        ON custom_totals.order_number = od.order_id
        AND custom_totals.inventory_item_code = od.item_id
      LEFT JOIN xxafmc_inventory xi
        ON xi.item_code = od.item_id
      WHERE od.order_id = ?
        AND TRIM(UPPER(IFNULL(od.order_status, ''))) != 'CANCELLED'
      ORDER BY od.order_line_id ASC
    `,
    [normalizedOrderNumber]
  );

  if (!detailRows.length) {
    const error = new Error("Invoice report data not found");
    error.statusCode = 404;
    throw error;
  }

  const [headerRows] = await db.execute(
    `
      SELECT
        oh.order_num,
        oh.order_date,
        ROUND(IFNULL(oh.order_total, 0), 2) AS order_total,
        inv.invoice_id,
        inv.invoice_date,
        inv.payment_method,
        inv.payment_status,
        ROUND(IFNULL(inv.amount, 0), 2) AS invoice_amount
      FROM xxafmc_order_header oh
      LEFT JOIN xxafmc_invoices inv
        ON inv.order_num = oh.order_num
      WHERE oh.order_num = ?
      LIMIT 1
    `,
    [normalizedOrderNumber]
  );

  const header = headerRows[0] || {};
  const totalAmount = detailRows.reduce(
    (sum, row) => sum + Number(row.subtotal || 0),
    0
  );
  const totalQuantity = detailRows.reduce((sum, row) => {
    const status = String(row.order_status || "").trim().toUpperCase();
    return sum + (status === "CANCELLED" ? 0 : Number(row.quantity || 0));
  }, 0);
  const computedTotal = Number(totalAmount.toFixed(2));

  return {
    header: {
      order_num: header.order_num || normalizedOrderNumber,
      order_date: header.order_date || null,
      invoice_id: header.invoice_id || null,
      invoice_date: header.invoice_date || header.order_date || null,
      payment_method: header.payment_method || null,
      payment_status: header.payment_status || null,
      order_total: computedTotal,
      invoice_amount: computedTotal,
    },
    items: detailRows.map((row) => ({
      order_line_id: row.order_line_id,
      order_id: row.order_id,
      item_id: row.item_id,
      item_name: row.item_name,
      quantity: Number(row.quantity || 0),
      order_status: row.order_status,
      subtotal: Number(row.subtotal || 0),
      price: Number(row.price || 0),
      created_by: row.created_by,
      creation_date: row.creation_date,
      last_updated_date: row.last_updated_date,
      last_updated_by: row.last_updated_by,
    })),
    summary: {
      total_quantity: totalQuantity,
      total_amount: Number(totalAmount.toFixed(2)),
      total_label: "Total",
    },
  };
}

module.exports = { getInvoiceReportByOrderNumber };
