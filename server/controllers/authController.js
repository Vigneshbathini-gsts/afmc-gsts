const db = require("../config/db");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { getRedirectPath } = require("../utils/roleRedirect");
const nodemailer = require("nodemailer");
const { generateResetToken, hashPassword ,comparePassword} = require("../helpers/authHelper");

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




// =========================
// Forgot Password
// =========================
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    console.log("Forgot Password Request for:", email);

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Check user exists
    const [users] = await db.query(
      "SELECT * FROM xxafmc_users WHERE EMAIL = ?",
      [email]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = users[0];

    if (!user.EMAIL) {
      return res.status(400).json({ message: "Email not available for this user" });
    }

    // Generate token and expiry
    const resetToken = generateResetToken();
    const expiryTime = new Date(Date.now() + 15 * 60 * 1000);

    // Save token in DB
    await db.query(
      "UPDATE xxafmc_users SET RESET_TOKEN = ?, RESET_EXPIRY = ? WHERE USER_ID = ?",
      [resetToken, expiryTime, user.USER_ID]
    );

    // Include username in URL
    const resetLink = `http://localhost:3000/reset-password/${resetToken}?username=${encodeURIComponent(
      user.USER_NAME
    )}`;

    // Mail config
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.EMAIL,
      subject: "Password Reset Request",
      html: `
        <h3>Reset Your Password</h3>
        <p>Hello ${user.FIRST_NAME || user.USER_NAME},</p>
        <p>Click the link below to reset your password:</p>
        <a href="${resetLink}">${resetLink}</a>
        <p>This link will expire in 15 minutes.</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({
      success: true,
      message: "Password reset link sent to registered email",
    });
  } catch (err) {
    console.log("Forgot Password Error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// =========================
// Reset Password
// =========================
exports.resetPassword = async (req, res) => {
  try {
    const {username, token, password, confirmPassword } = req.body;
    if (!token || !password || !confirmPassword) {
      return res.status(400).json({
        message: "Token, password and confirm password are required",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        message: "Password and confirm password do not match",
      });
    }

    // Find user with valid token
   const [users] = await db.query(
  "SELECT * FROM xxafmc_users WHERE RESET_TOKEN = ? AND USER_NAME = ? AND RESET_EXPIRY > NOW()",
  [token, username]
);

    if (users.length === 0) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    const user = users[0];

    // Hash new password (MD5)
    const hashedPassword = hashPassword(password);

    // Update password and clear token
    await db.query(
      `UPDATE xxafmc_users
       SET PASSWORD = ?, RESET_TOKEN = NULL, RESET_EXPIRY = NULL
       WHERE USER_ID = ?`,
      [hashedPassword, user.USER_ID]
    );

    return res.status(200).json({
      success: true,
      message: "Password reset successful",
    });
  } catch (err) {
    console.log("Reset Password Error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};


/**
 * CHANGE PASSWORD
 */
exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword, confirmPassword } = req.body;
    const username = req.user?.username || req.user?.user_name;

    // Validation
    if (!username || !oldPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New password and confirm password do not match",
      });
    }

    // Fetch user
    const [users] = await db.query(
      `SELECT user_id, user_name, password
       FROM xxafmc_users
       WHERE UPPER(user_name) = UPPER(?)`,
      [username]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const user = users[0];

    // Compare old password
    const isOldPasswordValid = comparePassword(oldPassword, user.password);

    if (!isOldPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Old password is incorrect",
      });
    }

    // Prevent same password reuse
    const isSamePassword = comparePassword(newPassword, user.password);

    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: "New password cannot be same as old password",
      });
    }

    // MD5 hash new password
    const hashedPassword = hashPassword(newPassword);

    // Update password
   await db.query(
  `UPDATE xxafmc_users 
   SET password = ?
   WHERE user_id = ?`,
  [hashedPassword, user.user_id]
);

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Error in changePassword:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};