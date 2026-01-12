const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getDbPool } = require("../../config/db");
const env = require("../../config/env");

const loginUser = async (email, password) => {
  const pool = await getDbPool();

  // 1. Find user by email
  const result = await pool
    .request()
    .input("email", email)
    .query(`
      SELECT id, name, email, passwordHash, role
      FROM Users
      WHERE email = @email AND isActive = 1
    `);

  if (result.recordset.length === 0) {
    throw new Error("Invalid email or password");
  }

  const user = result.recordset[0];

  // 2. Compare password
  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new Error("Invalid email or password");
  }

  // 3. Generate JWT
  const token = jwt.sign(
    {
      id: user.id,
      role: user.role,
    },
    env.jwt.secret,
    { expiresIn: "8h" }
  );

  // 4. Return response
  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
};

module.exports = {
  loginUser,
};
