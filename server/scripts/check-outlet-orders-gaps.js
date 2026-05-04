require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const pool = require("../config/db");
const controller = require("../controllers/KitchenOrdersController");

function createRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

async function getControllerOrders(username, kitchen) {
  const res = createRes();
  await controller.getOrders(
    { query: { kitchen }, user: { username }, body: {} },
    res
  );
  return Array.isArray(res.body) ? res.body : [];
}

async function main() {
  const [users] = await pool.query(
    "SELECT user_name, first_name FROM xxafmc_users WHERE role_id = 40 ORDER BY user_id"
  );

  const categories = [
    { kitchen: "Bar", categoryId: 10, handledByColumn: "handled_by_bar" },
    { kitchen: "Kitchen", categoryId: 14, handledByColumn: "handled_by_kitchen" },
  ];

  for (const category of categories) {
    const [rawRows] = await pool.query(
      `
      SELECT
        kn.ordernumber,
        kn.status,
        MAX(kn.${category.handledByColumn}) AS handled_by,
        COUNT(*) AS notification_rows
      FROM xxafmc_kitchen_notification kn
      JOIN (
        SELECT item_code, MAX(category_id) AS category_id
        FROM xxafmc_inventory
        GROUP BY item_code
      ) inv ON inv.item_code = kn.item_id
      WHERE inv.category_id = ?
        AND kn.status IN ('Received', 'Preparing', 'Completed')
      GROUP BY kn.ordernumber, kn.status
      ORDER BY kn.ordernumber DESC
      `,
      [category.categoryId]
    );

    const rawOrderNumbers = new Set(rawRows.map((row) => String(row.ordernumber)));
    console.log(
      JSON.stringify({
        kitchen: category.kitchen,
        rawStatusRows: rawRows.length,
        rawDistinctOrders: rawOrderNumbers.size,
        rawStatusCounts: rawRows.reduce((acc, row) => {
          acc[row.status] = (acc[row.status] || 0) + 1;
          return acc;
        }, {}),
      })
    );

    for (const user of users) {
      const rows = await getControllerOrders(user.user_name, category.kitchen);
      const visible = new Set(rows.map((row) => String(row.ORDERNUMBER)));
      const hidden = rawRows
        .filter((row) => !visible.has(String(row.ordernumber)))
        .slice(0, 10);

      console.log(
        JSON.stringify({
          kitchen: category.kitchen,
          username: user.user_name,
          firstName: user.first_name,
          visibleOrders: visible.size,
          hiddenSample: hidden,
        })
      );
    }
  }
}

main()
  .catch((error) => {
    console.error("Outlet order gap check failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
