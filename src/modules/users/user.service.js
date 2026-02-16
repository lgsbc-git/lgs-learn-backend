const { getDbPool } = require("../../config/db");
const bcrypt = require("bcryptjs");

/**
 * Fetch logged-in user profile
 */
const fetchMyProfile = async (userId) => {
  const pool = await getDbPool();

  const result = await pool.request().input("id", userId).query(`
      SELECT id, name, email, role, isActive, createdAt
      FROM Users
      WHERE id = @id
    `);

  if (result.recordset.length === 0) {
    throw new Error("User not found");
  }

  return result.recordset[0];
};

/**
 * Admin: fetch all users
 */
const fetchAllUsers = async () => {
  const pool = await getDbPool();

  const result = await pool.query(`
    SELECT id, name, email, role, isActive, createdAt
    FROM Users
    ORDER BY createdAt DESC
  `);

  return result.recordset;
};

/**
 * Admin: activate/deactivate user
 */
const setUserStatus = async (userId, isActive) => {
  const pool = await getDbPool();

  await pool
    .request()
    .input("id", userId)
    .input("isActive", isActive ? 1 : 0).query(`
      UPDATE Users
      SET isActive = @isActive
      WHERE id = @id
    `);
};

/**
 * Admin: set user role
 */
const setUserRole = async (userId, role) => {
  const pool = await getDbPool();

  await pool.request().input("id", userId).input("role", role).query(`
      UPDATE Users
      SET role = @role
      WHERE id = @id
    `);
};

/**
 * Admin: create a new user
 */
const createUser = async ({ name, email, role }) => {
  const pool = await getDbPool();

  // check existing
  const exist = await pool.request().input("email", email).query(`
    SELECT id FROM Users WHERE email = @email
  `);

  if (exist.recordset.length > 0) {
    throw new Error("User with this email already exists");
  }

  // generate a simple unique alphanumeric password (timestamp + random)
  const plainPassword = `${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const passwordHash = await bcrypt.hash(plainPassword, 10);

  await pool
    .request()
    .input("name", name)
    .input("email", email)
    .input("role", role)
    .input("isActive", 1)
    .input("passwordHash", passwordHash).query(`
      INSERT INTO Users (name, email, role, isActive, passwordHash, createdAt)
      VALUES (@name, @email, @role, @isActive, @passwordHash, GETDATE())
    `);

  const res = await pool.request().input("email", email).query(`
    SELECT id FROM Users WHERE email = @email
  `);

  return { userId: res.recordset[0].id, password: plainPassword };
};

/**
 * Admin: delete user from database
 */
const deleteUser = async (userId) => {
  const pool = await getDbPool();

  // Check if user exists
  const userCheck = await pool.request().input("id", userId).query(`
    SELECT id FROM Users WHERE id = @id
  `);

  if (userCheck.recordset.length === 0) {
    throw new Error("User not found");
  }

  // Delete related records first (foreign key constraints)
  // Delete from QuizSubmissionRejectionLog (must come before QuizSubmissions)
  // Note: Delete records where user is either the employee or the staff who rejected
  await pool.request().input("userId", userId).query(`
    DELETE FROM QuizSubmissionRejectionLog 
    WHERE employeeUserId = @userId OR staffUserId = @userId
  `);

  // Delete from LessonProgress
  await pool.request().input("userId", userId).query(`
    DELETE FROM LessonProgress WHERE userId = @userId
  `);

  // Delete from QuizSubmissions
  await pool.request().input("userId", userId).query(`
    DELETE FROM QuizSubmissions WHERE userId = @userId
  `);

  // Delete from TeamMembers
  await pool.request().input("userId", userId).query(`
    DELETE FROM TeamMembers WHERE userId = @userId
  `);

  // Delete from CourseAssignments
  await pool.request().input("userId", userId).query(`
    DELETE FROM CourseAssignments WHERE userId = @userId
  `);

  // Delete from TestSubmissions
  await pool.request().input("userId", userId).query(`
    DELETE FROM TestSubmissions WHERE userId = @userId
  `);

  // Delete the user
  await pool.request().input("id", userId).query(`
    DELETE FROM Users WHERE id = @id
  `);
};

module.exports = {
  fetchMyProfile,
  fetchAllUsers,
  setUserStatus,
  setUserRole,
  createUser,
  deleteUser,
};
