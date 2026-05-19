const db = require("../config/db");
const crypto = require("crypto");
const { formatToSql, toISO } = require("../utils/dateUtils");

const BASE_USER_SELECT = `
  SELECT
    xu.USER_ID,
    xu.USER_ID AS S_NO,
    xu.OFFICER_ID,
    xu.ROLE_ID,
    xu.LOGIN_TYPE,
    xu.First_name,
    xu.EMAIL,
    xu.PHONE_NUMBER,
    xu.ATTRIBUTE1,
    CASE
      WHEN xu.attribute1 = 'A' THEN 'Active'
      ELSE 'Inactive'
    END AS status,
    xu.USER_NAME,
    CONCAT(
      UPPER(LEFT(xu.ROLE, 1)),
      LOWER(SUBSTRING(xu.ROLE, 2))
    ) AS Role
  FROM xxafmc_users xu
  WHERE xu.ROLE_ID NOT IN (50, 60, 70)
`;

const getAllUsers = async ({ search = "" } = {}) => {
  const trimmedSearch = search.trim();
  let query = `
    ${BASE_USER_SELECT}
  `;
  const params = [];

  if (trimmedSearch) {
    query += `
      AND (
        xu.USER_NAME LIKE ?
        OR xu.First_name LIKE ?
        OR xu.OFFICER_ID LIKE ?
        OR xu.USER_ID LIKE ?
        OR xu.ROLE LIKE ?
      )
    `;

    const likeValue = `%${trimmedSearch}%`;
    params.push(likeValue, likeValue, likeValue, likeValue, likeValue);
  }

  query += " ORDER BY xu.USER_ID DESC";

  const [rows] = await db.execute(query, params);
  return rows;
};

const getUserById = async (userId) => {
  const query = `
    ${BASE_USER_SELECT}
    AND xu.USER_ID = ?
    ORDER BY xu.USER_ID DESC
  `;

  const [rows] = await db.execute(query, [userId]);
  return rows[0] || null;
};

const getRoleOptionsByLoginType = async (loginType) => {
  const normalizedLoginType = String(loginType || "").trim().toUpperCase();

  if (normalizedLoginType === "NON MEMBER") {
    const [userRoleRows] = await db.execute(
      `
        SELECT
          CONCAT(UPPER(LEFT(ROLE, 1)), LOWER(SUBSTRING(ROLE, 2))) AS ROLE_NAME
        FROM xxafmc_role
        WHERE ROLE_CODE = 'USER'
        LIMIT 1
      `
    );

    if (!userRoleRows[0]) {
      return [];
    }

    return [
      {
        ROLE_ID: 30,
        ROLE_NAME: userRoleRows[0].ROLE_NAME,
      },
    ];
  }

  const [rows] = await db.execute(
    `
      SELECT
        ROLE_ID,
        CASE
          WHEN ROLE_CODE = 'USER' THEN CONCAT(UPPER(LEFT(ROLE, 1)), LOWER(SUBSTRING(ROLE, 2)))
          WHEN ROLE_CODE = 'STMG' THEN 'Admin'
          WHEN ROLE_CODE = 'MBOP' THEN 'Order Attendant'
          WHEN ROLE_CODE = 'STKP' THEN 'Store Keeper'
          WHEN ROLE_CODE = 'KADM' THEN 'Kitchen Admin'
          ELSE CONCAT(UPPER(LEFT(ROLE, 1)), LOWER(SUBSTRING(ROLE, 2)))
        END AS ROLE_NAME
      FROM xxafmc_role
      WHERE ROLE_CODE IN ('STMG', 'USER', 'MBOP', 'STKP', 'KADM')
      ORDER BY ROLE_ID
    `
  );

  return rows;
};

const mapRoleName = (roleCode, role) => {
  if (roleCode === "STMG") return "Admin";
  if (roleCode === "MBOP") return "Order Attendant";
  if (roleCode === "STKP") return "Store Keeper";
  if (roleCode === "KADM") return "Kitchen Admin";
  return `${String(role || "").charAt(0).toUpperCase()}${String(role || "")
    .slice(1)
    .toLowerCase()}`;
};

const getRoleForLoginType = async (loginType) => {
  const normalizedLoginType = String(loginType || "").trim().toUpperCase();
  if (normalizedLoginType === "NON MEMBER") {
    const [userRoleRows] = await db.execute(
      `
        SELECT ROLE
        FROM xxafmc_role
        WHERE ROLE_CODE = 'USER'
        LIMIT 1
      `
    );

    if (!userRoleRows[0]) {
      return null;
    }

    return {
      ROLE_ID: 30,
      ROLE: userRoleRows[0].ROLE,
      ROLE_CODE: "MBOP",
      ROLE_NAME: mapRoleName("USER", userRoleRows[0].ROLE),
    };
  }

  const roleId = 20;

  const [roleRows] = await db.execute(
    `
      SELECT ROLE_ID, ROLE, ROLE_CODE
      FROM xxafmc_role
      WHERE ROLE_ID = ?
      LIMIT 1
    `,
    [roleId]
  );

  if (!roleRows[0]) {
    return null;
  }

  return {
    ROLE_ID: roleRows[0].ROLE_ID,
    ROLE: roleRows[0].ROLE,
    ROLE_CODE: roleRows[0].ROLE_CODE,
    ROLE_NAME: mapRoleName(roleRows[0].ROLE_CODE, roleRows[0].ROLE),
  };
};

const resolveRoleDetails = async ({ loginType, roleId }) => {
  const normalizedLoginType = String(loginType || "").trim().toUpperCase();
  const normalizedRoleId = Number(roleId);
  const roleOptions = await getRoleOptionsByLoginType(loginType);
  const selectedRole = roleOptions.find(
    (role) => Number(role.ROLE_ID) === normalizedRoleId
  );

  if (!selectedRole) {
    return null;
  }

  if (normalizedLoginType === "NON MEMBER") {
    const [userRoleRows] = await db.execute(
      `
        SELECT ROLE
        FROM xxafmc_role
        WHERE ROLE_CODE = 'USER'
        LIMIT 1
      `
    );

    if (!userRoleRows[0]) {
      return null;
    }

    return {
      ROLE_ID: 30,
      ROLE: userRoleRows[0].ROLE,
      ROLE_CODE: "MBOP",
      ROLE_NAME: selectedRole.ROLE_NAME,
    };
  }

  const [roleRows] = await db.execute(
    `
      SELECT ROLE_ID, ROLE, ROLE_CODE
      FROM xxafmc_role
      WHERE ROLE_ID = ?
      LIMIT 1
    `,
    [normalizedRoleId]
  );

  if (!roleRows[0]) {
    return null;
  }

  return {
    ROLE_ID: normalizedRoleId,
    ROLE: roleRows[0].ROLE,
    ROLE_CODE: roleRows[0].ROLE_CODE,
    ROLE_NAME: selectedRole.ROLE_NAME,
  };
};

const createUser = async ({
  loginType,
  firstName,
  lastName,
  userName,
  password,
  email,
  phoneNumber,
  createdBy,
}) => {
  const normalizedLoginType =
    String(loginType || "").trim().toUpperCase() === "NON MEMBER"
      ? "Non Member"
      : "Member";

  const roleDetails = await getRoleForLoginType(normalizedLoginType);

  if (!roleDetails) {
    throw new Error("Unable to resolve role for selected login type");
  }

  const md5Password = crypto
    .createHash("md5")
    .update(String(password))
    .digest("hex")
    .toUpperCase();

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [existingUsers] = await connection.execute(
      `
        SELECT USER_ID
        FROM xxafmc_users
        WHERE UPPER(USER_NAME) = UPPER(?)
           OR UPPER(EMAIL) = UPPER(?)
        LIMIT 1
      `,
      [userName, email]
    );

    if (existingUsers.length) {
      throw new Error("Username or email already exists");
    }

    const [maxUserIdRows] = await connection.execute(
      "SELECT COALESCE(MAX(USER_ID), 0) + 1 AS nextUserId FROM xxafmc_users"
    );

    const nextUserId = maxUserIdRows[0]?.nextUserId;

    await connection.execute(
      `
        INSERT INTO xxafmc_users (
          USER_ID,
          USER_NAME,
          PASSWORD,
          FIRST_NAME,
          LAST_NAME,
          EMAIL,
          PHONE_NUMBER,
          ROLE,
          ROLE_ID,
          LOGIN_TYPE,
          CREATION_BY,
          CREATION_DATE,
          ATTRIBUTE1,
          REQUIRED_PASSWORD_CHANGE,
          CONFIRM_PASSWORD
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        nextUserId,
        userName,
        md5Password,
        firstName,
        lastName,
        email,
        phoneNumber,
        roleDetails.ROLE,
        roleDetails.ROLE_ID,
        normalizedLoginType,
        createdBy,
        formatToSql(new Date()),
        "A",
        "Y",
        md5Password,
      ]
    );

    await connection.commit();

    return getUserById(nextUserId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updateUser = async (
  userId,
  { roleId, status, firstName, loginType, email, phoneNumber }
) => {
  const normalizedLoginType =
    String(loginType || "").trim().toUpperCase() === "NON MEMBER"
      ? "Non Member"
      : "Member";
  const normalizedStatus =
    String(status || "").trim().toUpperCase() === "ACTIVE" ? "A" : "I";

  const roleDetails = await resolveRoleDetails({
    loginType: normalizedLoginType,
    roleId,
  });

  if (!roleDetails) {
    throw new Error("Unable to resolve role for selected login type and role");
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [existingUsers] = await connection.execute(
      `
        SELECT USER_ID
        FROM xxafmc_users
        WHERE UPPER(EMAIL) = UPPER(?)
          AND USER_ID <> ?
        LIMIT 1
      `,
      [email, userId]
    );

    if (existingUsers.length) {
      throw new Error("Email already exists");
    }

    const [result] = await connection.execute(
      `
        UPDATE xxafmc_users
        SET
          ROLE_ID = ?,
          ATTRIBUTE1 = ?,
          FIRST_NAME = ?,
          LOGIN_TYPE = ?,
          EMAIL = ?,
          PHONE_NUMBER = ?,
          ROLE = ?
        WHERE USER_ID = ?
      `,
      [
        roleDetails.ROLE_ID,
        normalizedStatus,
        firstName,
        normalizedLoginType,
        email,
        phoneNumber,
        roleDetails.ROLE,
        userId,
      ]
    );

    if (!result.affectedRows) {
      throw new Error("User not found");
    }

    await connection.commit();
    return getUserById(userId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const encryptLegacyPassword = (password) =>
  crypto.createHash("md5").update(String(password)).digest("hex").toUpperCase();

const createBulkUsers = async ({ rows, createdBy }) => {
  const connection = await db.getConnection();
  const insertedUsers = [];
  const skippedRows = [];

  try {
    await connection.beginTransaction();

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const rowNumber = index + 2;

      const [existingOfficerRows] = await connection.execute(
        `
          SELECT OFFICER_ID
          FROM xxafmc_officers_information
          WHERE UPPER(FIRST_NAME) = UPPER(?)
          LIMIT 1
        `,
        [row.fullName]
      );

      if (existingOfficerRows.length) {
        skippedRows.push({
          rowNumber,
          reason: `Employee already exists: ${row.fullName}`,
        });
        continue;
      }

      const [existingUserRows] = await connection.execute(
        `
          SELECT USER_ID
          FROM xxafmc_users
          WHERE UPPER(USER_NAME) = UPPER(?)
             OR UPPER(EMAIL) = UPPER(?)
          LIMIT 1
        `,
        [row.userName, row.email]
      );

      if (existingUserRows.length) {
        skippedRows.push({
          rowNumber,
          reason: `Username or email already exists: ${row.userName}`,
        });
        continue;
      }

      const [roleRows] = await connection.execute(
        `
          SELECT ROLE_ID, ROLE
          FROM xxafmc_role
          WHERE UPPER(ROLE) = UPPER(?)
          LIMIT 1
        `,
        [row.loginType]
      );

      if (!roleRows.length) {
        skippedRows.push({
          rowNumber,
          reason: `Invalid role: ${row.loginType}`,
        });
        continue;
      }

      const role = roleRows[0];

      const [[nextOfficerRow]] = await connection.execute(
        `
          SELECT COALESCE(MAX(OFFICER_ID), 0) + 1 AS nextOfficerId
          FROM xxafmc_officers_information
        `
      );

      const nextOfficerId = nextOfficerRow?.nextOfficerId;

      await connection.execute(
        `
          INSERT INTO xxafmc_officers_information (
            OFFICER_ID,
            ROLE_ID,
            FIRST_NAME,
            LAST_NAME,
            FULL_NAME,
            EMAIL,
            CREATION_DATE,
            CREATED_BY,
            LAST_UPDATE_DATE,
            LAST_UPDATED_BY
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          nextOfficerId,
          role.ROLE_ID,
          row.firstName,
          row.lastName,
          row.fullName,
          row.email,
          formatToSql(new Date()),
          createdBy,
          formatToSql(new Date()),
          createdBy,
        ]
      );

      const [[nextUserRow]] = await connection.execute(
        `
          SELECT COALESCE(MAX(USER_ID), 0) + 1 AS nextUserId
          FROM xxafmc_users
        `
      );

      const encryptedPassword = encryptLegacyPassword(row.password);

      await connection.execute(
        `
          INSERT INTO xxafmc_users (
            USER_ID,
            USER_NAME,
            PASSWORD,
            OFFICER_ID,
            ROLE,
            ROLE_ID,
            LOGIN_TYPE,
            REQUIRED_PASSWORD_CHANGE,
            CREATION_BY,
            CREATION_DATE,
            LAST_UPDATE_DATE,
            LAST_UPDATED_BY,
            ATTRIBUTE1,
            CONFIRM_PASSWORD,
            EMAIL,
            FIRST_NAME,
            LAST_NAME
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          nextUserRow?.nextUserId,
          row.email || row.userName,
          encryptedPassword,
          nextOfficerId,
          role.ROLE,
          role.ROLE_ID,
          "Member",
          "N",
          createdBy,
          formatToSql(new Date()),
          formatToSql(new Date()),
          createdBy,
          "A",
          encryptedPassword,
          row.email,
          row.firstName,
          row.lastName,
        ]
      );

      insertedUsers.push({
        officerId: nextOfficerId,
        userName: row.userName,
        email: row.email,
      });
    }

    await connection.commit();

    return {
      insertedCount: insertedUsers.length,
      skippedCount: skippedRows.length,
      insertedUsers,
      skippedRows,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  getRoleOptionsByLoginType,
  createUser,
  updateUser,
  createBulkUsers,
};
