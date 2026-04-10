const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const generateResetToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

const hashPassword = (password) => {
  return crypto.createHash("md5").update(password).digest("hex").toUpperCase();
};

const comparePassword = (plainPassword, storedPassword) => {
  const hashedInput = hashPassword(plainPassword);
  console.log("Comparing Passwords:", {
    plainPassword,
    hashedInput,
    storedPassword,
  });

  return hashedInput === storedPassword.toUpperCase();
};

module.exports = {
  generateResetToken,
  hashPassword,
  comparePassword,
};