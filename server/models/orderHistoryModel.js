const db = require("../config/db");

const getOrderHistory = async ({
  fromDate,
  toDate,
  username,
}) => {
  let query = `
    SELECT
      oh.order_num,
      oh.order_total,
      oh.order_date,
      inv.payment_method,
      COALESCE(inv.payment_status, 'Un Paid') AS payment_status,
      u.first_name
    FROM xxafmc_order_header oh
    LEFT JOIN xxafmc_invoices inv
      ON inv.order_num = oh.order_num
    LEFT JOIN xxafmc_users u
      ON u.user_id = oh.user_id
    WHERE DATE(oh.order_date)
      BETWEEN COALESCE(?, CURDATE())
      AND COALESCE(?, CURDATE())
  `;

  const params = [fromDate, toDate];

  if (username) {
    query += ` AND UPPER(u.first_name) = UPPER(?)`;
    params.push(username);
  }

  query += ` ORDER BY oh.order_num DESC`;

  const [rows] = await db.execute(query, params);

  return rows;
};

const getOrderDetails = async (orderId) => {
  const query = `
    SELECT
      od.order_line_id,
      od.item_id,
      od.quantity,
      od.price,
      od.subtotal,
      i.item_name,
      COALESCE(NULLIF(od.type, ''), 'NA') AS type,
      kn.status
    FROM xxafmc_order_details od
    LEFT JOIN xxafmc_inventory i
      ON i.item_code = od.item_id
    LEFT JOIN xxafmc_kitchen_notification kn
      ON kn.ordernumber = od.order_id
      AND kn.item_id = od.item_id
    WHERE od.order_id = ?
  `;

  const [rows] = await db.execute(query, [orderId]);

  return rows;
};
const fetchOrderDetails = async (orderNumber) => {
  const query = `
    SELECT 
      item_id,
      quantity,
      TO_CHAR(price, 'FM99999999990.00') AS price,
      TO_CHAR(subtotal, 'FM99999999990.00') AS total
    FROM xxafmc_order_details
    WHERE order_id = :orderNumber
      AND order_status IS NULL
  `;

  const result = await db.execute(query, {
    orderNumber,
  });

  return result.rows;
};
module.exports = {
  getOrderHistory,
  getOrderDetails,
    fetchOrderDetails,
};
