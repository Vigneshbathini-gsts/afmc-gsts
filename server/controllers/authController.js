const db = require("../config/db");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { getRedirectPath } = require("../utils/roleRedirect");

// helper: MD5 hash
const md5Hash = (text) => {
  return crypto.createHash("md5").update(text).digest("hex").toUpperCase();
};

exports.createUser = async (req, res) => {
  try {
    // TODO
  } catch (err) {
    console.log("Error while creating user:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};


// ==========================================
// GET USER ROLE BASED ON EMAIL / USERNAME
// ==========================================
exports.getUserRole = async (req, res) => {
  try {
    const { username } = req.body;
console.log("Get Role Request for:", username);
    if (!username) {
      return res.status(400).json({
        success: false,
        message: "Username / Email is required",
      });
    }

    const sql = `
      SELECT 
        u.USER_ID,
        u.USER_NAME,
        u.EMAIL,
        u.ROLE_ID,
        r.ROLE_CODE,
        r.ROLE_NAME
      FROM xxafmc_users u
      JOIN xxafmc_role r 
        ON u.ROLE_ID = r.ROLE_ID
      WHERE u.EMAIL = ? OR u.USER_NAME = ?
      LIMIT 1
    `;

    const [rows] = await db.execute(sql, [username, username]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const user = rows[0];

    return res.status(200).json({
      success: true,
      roleId: user.ROLE_ID,
      roleCode: user.ROLE_CODE,
      roleName: user.ROLE_NAME,
      showOutletSelection: Number(user.ROLE_ID) === 40,
    });
  } catch (error) {
    console.error("Get User Role Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching role",
      error: error.message,
    });
  }
};


// ==========================================
// LOGIN USER
// ==========================================
exports.loginUser = async (req, res) => {
  try {
    const { username, password, outletType } = req.body;

    console.log("Login Attempt:", { username, outletType });

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required",
      });
    }

    const encryptedPwd = md5Hash(password);

    const sql = `
      SELECT 
        u.USER_ID,
        u.USER_NAME,
        u.EMAIL,
        u.PHONE_NUMBER,
        u.ROLE_ID,
        r.ROLE_CODE,
        r.ROLE_NAME
      FROM xxafmc_users u
      JOIN xxafmc_role r 
        ON u.ROLE_ID = r.ROLE_ID
      WHERE (u.EMAIL = ? OR u.USER_NAME = ?)
        AND u.PASSWORD = ?
      LIMIT 1
    `;

    const [rows] = await db.execute(sql, [username, username, encryptedPwd]);


    if (!rows || rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }

    const user = rows[0];

    // If role 40, outlet is mandatory
    if (Number(user.ROLE_ID) === 40 && !outletType) {
      return res.status(400).json({
        success: false,
        message: "Please select Kitchen or Bar",
      });
    }

    const redirectPath = getRedirectPath(user.ROLE_ID, outletType);


    const token = jwt.sign(
      {
        userId: user.USER_ID,
        username: user.USER_NAME,
        roleId: user.ROLE_ID,
        roleCode: user.ROLE_CODE,
        outletType: outletType || null,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      redirectPath,
      user: {
        userId: user.USER_ID,
        username: user.USER_NAME,
        email: user.EMAIL,
        phoneNumber: user.PHONE_NUMBER,
        roleId: user.ROLE_ID,
        roleCode: user.ROLE_CODE,
        roleName: user.ROLE_NAME,
        outletType: outletType || null,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during login",
      error: error.message,
    });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    // TODO
  } catch (err) {
    console.log("Error while forgot password:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};