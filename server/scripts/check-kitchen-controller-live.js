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

async function callGetOrders(username, kitchen) {
  const req = {
    query: { kitchen },
    user: { username },
    body: {},
  };
  const res = createRes();
  await controller.getOrders(req, res);
  return {
    username,
    kitchen,
    statusCode: res.statusCode,
    count: Array.isArray(res.body) ? res.body.length : null,
    sample: Array.isArray(res.body) ? res.body.slice(0, 3) : res.body,
  };
}

async function main() {
  const [users] = await pool.query(
    "SELECT user_name FROM xxafmc_users WHERE role_id = 40 ORDER BY user_id LIMIT 5"
  );

  if (!users.length) {
    console.log("No role-40 kitchen/bar users found for live controller check.");
    return;
  }

  for (const user of users) {
    for (const kitchen of ["Bar", "Kitchen"]) {
      const result = await callGetOrders(user.user_name, kitchen);
      console.log(JSON.stringify(result));
    }
  }
}

main()
  .catch((error) => {
    console.error("Live controller check failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });


