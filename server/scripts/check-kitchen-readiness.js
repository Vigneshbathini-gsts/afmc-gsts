const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const requiredTables = [
  "xxafmc_kitchen_notification",
  "xxafmc_inventory",
  "xxafmc_order_details",
  "xxafmc_order_header",
  "xxafmc_users",
  "order_scan_collection",
  "xxafmc_stock_out",
];

const requiredColumns = {
  xxafmc_kitchen_notification: [
    "ordernumber",
    "status",
    "item_id",
    "user_name",
    "handled_by_bar",
    "handled_by_kitchen",
    "notification_id",
    "creation_date",
  ],
  xxafmc_inventory: ["item_code", "item_name", "category_id", "sub_category"],
  xxafmc_order_details: [
    "order_id",
    "order_line_id",
    "item_id",
    "quantity",
    "order_status",
    "type",
    "subcategory",
    "barcode",
    "free_item_quantity",
  ],
  xxafmc_order_header: ["order_num", "user_id", "member_id", "order_date"],
  xxafmc_users: ["user_id", "user_name", "first_name", "role_id"],
  order_scan_collection: [
    "collection_name",
    "order_number",
    "item_code",
    "item_name",
    "scan_quantity",
    "item_price",
    "barcode",
    "inventory_item_code",
    "extra_data",
  ],
  xxafmc_stock_out: [
    "item_code",
    "barcode",
    "stock_quantity",
    "unit_price",
    "A/C_UNIT",
    "pegs",
  ],
};

async function main() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    console.log("DB connection: OK");

    const [tableRows] = await db.query(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?)",
      [requiredTables]
    );
    const existingTables = new Set(tableRows.map((row) => row.TABLE_NAME));
    const missingTables = requiredTables.filter((table) => !existingTables.has(table));

    console.log(`Tables found: ${tableRows.length}/${requiredTables.length}`);
    console.log(`Tables missing: ${missingTables.length ? missingTables.join(", ") : "none"}`);

    const missingColumns = [];
    for (const [table, columns] of Object.entries(requiredColumns)) {
      if (!existingTables.has(table)) continue;

      const [columnRows] = await db.query(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
        [table]
      );
      const existingColumns = new Set(columnRows.map((row) => row.COLUMN_NAME.toLowerCase()));
      for (const column of columns) {
        if (!existingColumns.has(column.toLowerCase())) {
          missingColumns.push(`${table}.${column}`);
        }
      }
    }

    console.log(`Columns missing: ${missingColumns.length ? missingColumns.join(", ") : "none"}`);

    const [statusRows] = await db.query(
      "SELECT status, COUNT(*) AS count FROM xxafmc_kitchen_notification GROUP BY status ORDER BY count DESC"
    );
    console.log(`Kitchen statuses: ${JSON.stringify(statusRows)}`);

    const [categoryRows] = await db.query(
      "SELECT category_id, COUNT(*) AS count FROM xxafmc_inventory WHERE category_id IN (10, 14) GROUP BY category_id ORDER BY category_id"
    );
    console.log(`Inventory category counts: ${JSON.stringify(categoryRows)}`);

    const [joinRows] = await db.query(`
      SELECT
        SUM(CASE WHEN inv.item_code IS NULL THEN 1 ELSE 0 END) AS missing_inventory_links,
        SUM(CASE WHEN od.order_id IS NULL THEN 1 ELSE 0 END) AS missing_order_detail_links,
        COUNT(*) AS notification_rows_checked
      FROM xxafmc_kitchen_notification kn
      LEFT JOIN xxafmc_inventory inv ON inv.item_code = kn.item_id
      LEFT JOIN xxafmc_order_details od ON od.order_id = kn.ordernumber AND od.item_id = kn.item_id
    `);
    console.log(`Notification link health: ${JSON.stringify(joinRows[0])}`);

    const [userRows] = await db.query(
      "SELECT user_id, user_name, first_name, role_id FROM xxafmc_users WHERE role_id = 40 ORDER BY user_id LIMIT 10"
    );
    console.log(`Kitchen/bar users sample: ${JSON.stringify(userRows)}`);

    const [missingInventoryRows] = await db.query(`
      SELECT kn.ordernumber, kn.item_id, kn.status, COUNT(*) AS count
      FROM xxafmc_kitchen_notification kn
      LEFT JOIN xxafmc_inventory inv ON inv.item_code = kn.item_id
      WHERE inv.item_code IS NULL
      GROUP BY kn.ordernumber, kn.item_id, kn.status
      ORDER BY kn.ordernumber DESC
      LIMIT 10
    `);
    console.log(`Missing inventory link sample: ${JSON.stringify(missingInventoryRows)}`);

    const [activeByCategoryRows] = await db.query(`
      SELECT inv.category_id, kn.status, COUNT(*) AS count
      FROM xxafmc_kitchen_notification kn
      JOIN xxafmc_inventory inv ON inv.item_code = kn.item_id
      WHERE inv.category_id IN (10, 14)
        AND kn.status IN ('Received', 'Preparing', 'Completed')
      GROUP BY inv.category_id, kn.status
      ORDER BY inv.category_id, kn.status
    `);
    console.log(`Kitchen/bar status by category: ${JSON.stringify(activeByCategoryRows)}`);

    if (missingTables.length || missingColumns.length) {
      process.exitCode = 1;
    }
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error("Readiness check failed:", error.code || error.message);
  process.exit(1);
});
