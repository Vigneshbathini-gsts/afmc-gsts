require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const pool = require("../config/db");
const kitchenController = require("../controllers/KitchenOrdersController");
const adminCancelledController = require("../controllers/cancelledOrdersController");

function createRes(label) {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      const count = Array.isArray(payload?.data) ? payload.data.length : null;
      console.log(
        JSON.stringify({
          label,
          statusCode: this.statusCode,
          success: payload?.success,
          count,
          pagination: payload?.pagination || null,
          sample: Array.isArray(payload?.data) ? payload.data.slice(0, 3) : payload,
        })
      );
      return this;
    },
  };
}

async function main() {
  const query = { fromDate: "2026-01-01", toDate: "2026-04-30", page: "1", limit: "10" };

  await kitchenController.getOrderHistory(
    { query, user: { username: "satish@gmail.com" } },
    createRes("kitchen-order-history")
  );

  await kitchenController.getCancelledOrders(
    { query, user: { username: "satish@gmail.com" } },
    createRes("kitchen-cancelled-orders")
  );

  await adminCancelledController.getCancelledOrders(
    { query },
    createRes("admin-cancelled-orders")
  );

  const [cancelledDetailRows] = await pool.query(`
    SELECT od.order_id
    FROM xxafmc_order_details od
    GROUP BY od.order_id
    HAVING COUNT(*) = SUM(CASE WHEN TRIM(UPPER(IFNULL(od.order_status, ''))) = 'CANCELLED' THEN 1 ELSE 0 END)
    ORDER BY od.order_id DESC
    LIMIT 1
  `);

  const cancelledOrder = cancelledDetailRows[0]?.order_id;
  if (cancelledOrder) {
    await kitchenController.getOrderDetailsByOrderNumber(
      { params: { orderNumber: cancelledOrder }, user: { username: "satish@gmail.com" } },
      createRes("cancelled-order-details")
    );
  }

  const [historyDetailRows] = await pool.query(`
    SELECT ordernumber
    FROM xxafmc_kitchen_notification
    GROUP BY ordernumber
    HAVING SUM(CASE WHEN UPPER(status) = 'COMPLETED' THEN 1 ELSE 0 END) > 0
    ORDER BY ordernumber DESC
    LIMIT 1
  `);

  const historyOrder = historyDetailRows[0]?.ordernumber;
  if (historyOrder) {
    await kitchenController.getOrderHistoryItemDetails(
      { params: { orderNumber: historyOrder }, user: { username: "satish@gmail.com" } },
      createRes("order-history-details")
    );
  }
}

main()
  .catch((error) => {
    console.error("History/cancelled live check failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });


