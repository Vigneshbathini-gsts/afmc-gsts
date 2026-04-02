// auth controller
const pool = require("../config/db");



exports.createUser = async (req, res) => {
    try {


    } catch (err) {
        console.log("Error while logging:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}

exports.loginUser = async (req, res) => {
    try {


    } catch (err) {
        console.log("Error while logging:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}



exports.frogotPassword = async (req, res) => {
    try {


    } catch (err) {
        console.log("Error while logging:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}