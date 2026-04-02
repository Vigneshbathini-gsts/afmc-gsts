// auth controller
const pool = require("../config/db");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const db = require("../config/db");

// helper: MD5 hash to match to current DB password format
const md5Hash = (text) => {
    return crypto.createHash("md5").update(text).digest("hex").toUpperCase();
};

const { getRedirectPath } = require("../utils/roleRedirect");



exports.createUser = async (req, res) => {
    try {


    } catch (err) {
        console.log("Error while logging:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}

exports.loginUser = async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log("Login attempt:", { username, password: password ? "******" : "" });
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: "Username and password are required",
            });
        }

        const encryptedPwd = crypto
            .createHash("md5")
            .update(pwd)
            .digest("hex")
            .toUpperCase();


        const query = `
      SELECT 
        u.USER_ID,
        u.USER_NAME,
        u.PASSWORD,
        u.ROLE,
        u.ROLE_ID,
        u.LOGIN_TYPE,
        u.REQUIRED_PASSWORD_CHANGE,
        u.FIRST_NAME,
        u.LAST_NAME,
        u.EMAIL,
        u.PHONE_NUMBER,
        r.ROLE_NAME,
        r.ROLE_DESCRIPTION
      FROM xxafmc_users u
      LEFT JOIN xxafmc_role r ON u.ROLE_ID = r.ROLE_ID
      WHERE UPPER(u.USER_NAME) = UPPER(:username)
        AND u.PASSWORD = :password
        AND NVL(u.ATTRIBUTE1, 'A') = 'A'
    `;

        const result = await db.execute(query, {
            username,
            password: hashedPassword,
        });

        if (!result.rows || result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password",
            });
        }

        const user = result.rows[0];

        // determine frontend route based on role
        const redirectPath = getRedirectPath(user.ROLE_ID);
        const token = jwt.sign(
            {
                userId: user.USER_ID,
                username: user.USER_NAME,
                role: user.ROLE,
                roleId: user.ROLE_ID,
                loginType: user.LOGIN_TYPE,
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
                firstName: user.FIRST_NAME,
                lastName: user.LAST_NAME,
                email: user.EMAIL,
                phoneNumber: user.PHONE_NUMBER,
                role: user.ROLE,
                roleId: user.ROLE_ID,
                roleName: user.ROLE_NAME,
                loginType: user.LOGIN_TYPE,
                requiredPasswordChange: user.REQUIRED_PASSWORD_CHANGE,
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



exports.frogotPassword = async (req, res) => {
    try {


    } catch (err) {
        console.log("Error while logging:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}