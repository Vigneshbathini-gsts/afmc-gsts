const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const crypto = require("crypto");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const db = require("./config/db");

// ✅ Home route
app.get("/", (req, res) =>
  res.json({ status: "Server is running" })
);

// ✅ LOGIN API
app.get("/login", async (req, res) => {
  try {
    const { userName, pwd } = req.query;

    if (!userName || !pwd) {
      return res.status(400).json({
        result: 0,
        message: "Username and password required",
      });
    }

    // ✅ Encrypt password (MD5 - matches your DB)
    const encryptedPwd = crypto
      .createHash("md5")
      .update(pwd)
      .digest("hex")
      .toUpperCase();

    // ✅ Query with JOIN
    const sql = `
      SELECT 
        u.USER_ID,
        u.USER_NAME,
        u.ROLE_ID,
        r.ROLE_CODE,
        r.ROLE_NAME
      FROM xxafmc_users u
      JOIN xxafmc_role r 
        ON u.ROLE_ID = r.ROLE_ID
      WHERE u.EMAIL = ?
        AND u.PASSWORD = ?
    `;

    const [rows] = await db.query(sql, [userName, encryptedPwd]);

    // ❌ Invalid login
    if (rows.length === 0) {
      return res.json({
        result: 2,
        message: "Invalid username or password",
      });
    }

    const user = rows[0];

    // ✅ Success
    return res.json({
      result: 1,
      userid: user.USER_ID,
      username: user.USER_NAME,
      role_id: user.ROLE_ID,
      role_code: user.ROLE_CODE,
      role_name: user.ROLE_NAME,
    });

  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({
      result: 0,
      error: err.message,
    });
  }
});

// ✅ Optional: Get all users
app.get("/get", async (req, res) => {
  try {
    const sql = "SELECT * FROM xxafmc_users";
    const [rows] = await db.query(sql);

    res.json({
      success: true,
      data: rows,
    });
  } catch (err) {
    console.error("DB Error:", err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`Server listening on port ${PORT}`)
);