const db = require('../config/db');
(async () => {
  try {
    const [rows] = await db.query('SELECT cart_id, user_id, item_id, quantity, price, total, parent_code FROM xxafmc_cart_items ORDER BY cart_id DESC LIMIT 20');
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
})();
