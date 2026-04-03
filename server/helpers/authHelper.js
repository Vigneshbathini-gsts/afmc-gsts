const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const generateResetToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

module.exports = {
  generateResetToken,
  hashPassword,
};