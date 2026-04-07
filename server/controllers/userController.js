const userModel = require("../models/userModel");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\d{10}$/;

const normalizeUserPayload = (payload = {}) => ({
  loginType: String(payload.loginType || "").trim(),
  firstName: String(payload.firstName || "").trim(),
  lastName: String(payload.lastName || "").trim(),
  userName: String(payload.userName || "").trim(),
  password: String(payload.password || ""),
  confirmPassword: String(payload.confirmPassword || ""),
  email: String(payload.email || "").trim(),
  phoneNumber: String(payload.phoneNumber || "").trim(),
  createdBy: String(payload.createdBy || "").trim(),
  roleId: payload.roleId,
  status: String(payload.status || "").trim(),
});

const validateCreatePayload = (payload) => {
  if (
    !payload.loginType ||
    !payload.firstName ||
    !payload.lastName ||
    !payload.userName ||
    !payload.password ||
    !payload.confirmPassword ||
    !payload.email ||
    !payload.phoneNumber
  ) {
    return "All fields are required";
  }

  if (!["Member", "Non Member"].includes(payload.loginType)) {
    return "Invalid login type";
  }

  if (payload.firstName.length < 2 || payload.firstName.length > 50) {
    return "First name must be between 2 and 50 characters";
  }

  if (payload.lastName.length < 1 || payload.lastName.length > 50) {
    return "Last name must be between 1 and 50 characters";
  }

  if (!/^[A-Za-z0-9._-]{3,50}$/.test(payload.userName)) {
    return "User name must be 3 to 50 characters and can only include letters, numbers, dot, underscore, and hyphen";
  }

  if (payload.password.length < 6) {
    return "Password must be at least 6 characters";
  }

  if (payload.password !== payload.confirmPassword) {
    return "Password and confirm password must match";
  }

  if (!EMAIL_REGEX.test(payload.email)) {
    return "Please enter a valid email address";
  }

  if (!PHONE_REGEX.test(payload.phoneNumber)) {
    return "Phone number must be exactly 10 digits";
  }

  return null;
};

const validateUpdatePayload = (payload) => {
  if (
    !payload.roleId ||
    !payload.status ||
    !payload.firstName ||
    !payload.loginType ||
    !payload.email ||
    !payload.phoneNumber
  ) {
    return "All fields are required";
  }

  if (!["Member", "Non Member"].includes(payload.loginType)) {
    return "Invalid login type";
  }

  if (!["Active", "Inactive"].includes(payload.status)) {
    return "Invalid status";
  }

  if (!Number.isInteger(Number(payload.roleId)) || Number(payload.roleId) <= 0) {
    return "Invalid role selected";
  }

  if (payload.firstName.length < 2 || payload.firstName.length > 50) {
    return "Officer name must be between 2 and 50 characters";
  }

  if (!EMAIL_REGEX.test(payload.email)) {
    return "Please enter a valid email address";
  }

  if (!PHONE_REGEX.test(payload.phoneNumber)) {
    return "Phone number must be exactly 10 digits";
  }

  return null;
};

const parseCsvLine = (line) => {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values.map((value) => value.replace(/^"|"$/g, "").trim());
};

const parseBulkCsv = (buffer) => {
  const csvText = buffer.toString("utf8").replace(/^\uFEFF/, "");
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("The uploaded file does not contain any data rows");
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const expectedHeaders = [
    "login type",
    "full name with rank",
    "first name",
    "last name",
    "user name",
    "password",
    "confirm password",
    "email",
  ];

  if (
    headers.length !== expectedHeaders.length ||
    expectedHeaders.some((header, index) => headers[index] !== header)
  ) {
    throw new Error(
      "Invalid template. Please use the sample template for bulk upload"
    );
  }

  return lines.slice(1).map((line, index) => {
    const columns = parseCsvLine(line);

    return {
      rowNumber: index + 2,
      loginType: String(columns[0] || "").trim(),
      fullName: String(columns[1] || "").trim(),
      firstName: String(columns[2] || "").trim(),
      lastName: String(columns[3] || "").trim(),
      userName: String(columns[4] || "").trim(),
      password: String(columns[5] || "").trim(),
      confirmPassword: String(columns[6] || "").trim(),
      email: String(columns[7] || "").trim(),
    };
  });
};

const validateBulkRows = (rows) => {
  const errors = [];

  rows.forEach((row) => {
    if (
      !row.loginType ||
      !row.fullName ||
      !row.firstName ||
      !row.lastName ||
      !row.userName ||
      !row.password ||
      !row.confirmPassword ||
      !row.email
    ) {
      errors.push(`Row ${row.rowNumber}: all columns are required`);
      return;
    }

    if (row.password !== row.confirmPassword) {
      errors.push(`Row ${row.rowNumber}: password and confirm password must match`);
    }

    if (row.password.length < 6) {
      errors.push(`Row ${row.rowNumber}: password must be at least 6 characters`);
    }

    if (!EMAIL_REGEX.test(row.email)) {
      errors.push(`Row ${row.rowNumber}: invalid email address`);
    }

    if (!/^[A-Za-z0-9._-]{3,50}$/.test(row.userName)) {
      errors.push(`Row ${row.rowNumber}: invalid user name`);
    }
  });

  return errors;
};

exports.getAllUsers = async (req, res) => {
  try {
    const { search = "" } = req.query;
    const users = await userModel.getAllUsers({ search });

    return res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    console.error("Error while fetching users:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: error.message,
    });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await userModel.getUserById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Error while fetching user details:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user details",
      error: error.message,
    });
  }
};

exports.getRoleOptions = async (req, res) => {
  try {
    const { loginType = "Member" } = req.query;
    const roles = await userModel.getRoleOptionsByLoginType(loginType);

    return res.status(200).json({
      success: true,
      data: roles,
    });
  } catch (error) {
    console.error("Error while fetching role options:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch role options",
      error: error.message,
    });
  }
};

exports.createUser = async (req, res) => {
  try {
    const payload = normalizeUserPayload(req.body);
    const validationMessage = validateCreatePayload(payload);

    if (validationMessage) {
      return res.status(400).json({
        success: false,
        message: validationMessage,
      });
    }

    const createdUser = await userModel.createUser({
      loginType: payload.loginType,
      firstName: payload.firstName,
      lastName: payload.lastName,
      userName: payload.userName,
      password: payload.password,
      email: payload.email,
      phoneNumber: payload.phoneNumber,
      createdBy: payload.createdBy || "SYSTEM",
    });

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      data: createdUser,
    });
  } catch (error) {
    console.error("Error while creating user:", error);

    const statusCode =
      error.message === "Username or email already exists" ? 409 : 500;

    return res.status(statusCode).json({
      success: false,
      message:
        statusCode === 409
          ? error.message
          : "Failed to create user",
      error: error.message,
    });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = normalizeUserPayload(req.body);

    if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid user id",
      });
    }

    const validationMessage = validateUpdatePayload(payload);

    if (validationMessage) {
      return res.status(400).json({
        success: false,
        message: validationMessage,
      });
    }

    const updatedUser = await userModel.updateUser(id, {
      roleId: Number(payload.roleId),
      status: payload.status,
      firstName: payload.firstName,
      loginType: payload.loginType,
      email: payload.email,
      phoneNumber: payload.phoneNumber,
    });

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error while updating user:", error);

    const statusCode =
      error.message === "User not found"
        ? 404
        : error.message === "Email already exists"
          ? 409
          : 500;

    return res.status(statusCode).json({
      success: false,
      message:
        statusCode === 404 || statusCode === 409
          ? error.message
          : "Failed to update user",
      error: error.message,
    });
  }
};

exports.bulkUploadUsers = async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({
        success: false,
        message: "Please upload a CSV file",
      });
    }

    const rows = parseBulkCsv(req.file.buffer);
    const validationErrors = validateBulkRows(rows);

    if (validationErrors.length) {
      return res.status(400).json({
        success: false,
        message: "Bulk upload validation failed",
        errors: validationErrors,
      });
    }

    const createdBy =
      String(req.body?.createdBy || "").trim() || "SYSTEM";

    const result = await userModel.createBulkUsers({
      rows: rows.map((row) => ({
        loginType: row.loginType,
        fullName: row.fullName,
        firstName: row.firstName,
        lastName: row.lastName,
        userName: row.userName,
        password: row.password,
        email: row.email,
      })),
      createdBy,
    });

    return res.status(200).json({
      success: true,
      message: `Bulk upload completed. Created ${result.insertedCount} users.`,
      data: result,
    });
  } catch (error) {
    console.error("Error while bulk uploading users:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to bulk upload users",
      error: error.message,
    });
  }
};
