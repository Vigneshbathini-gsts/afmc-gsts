// MySQL connection config goes here
const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

//  Test connection on startup
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log(" MySQL connected successfully!");
    const [result] = await conn.query("SELECT 1");
    if (result) console.log(" Connection test query successful.");
    conn.release();
  } catch (err) {
    console.error(" MySQL connection failed!");
    console.error("Error details:", err.message);
    process.exit(1); 
  }
})();

module.exports = pool;