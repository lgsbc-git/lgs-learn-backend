const {
  fetchMyProfile,
  fetchAllUsers,
  setUserStatus,
  setUserRole,
  createUser,
} = require("./user.service");

/**
 * GET /users/me
 */
const getMyProfile = async (req, res) => {
  try {
    const user = await fetchMyProfile(req.user.id);
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /users
 */
const getAllUsers = async (req, res) => {
  try {
    const users = await fetchAllUsers();
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PATCH /users/:id/status
 */
const updateUserStatus = async (req, res) => {
  try {
    const { isActive } = req.body;
    const userId = req.params.id;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        message: "isActive must be boolean",
      });
    }

    await setUserStatus(userId, isActive);
    res.status(200).json({ message: "User status updated" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PATCH /users/:id/role
 */
const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const userId = req.params.id;

    if (!role || typeof role !== "string") {
      return res.status(400).json({ message: "role is required" });
    }

    // validate allowed roles
    const allowed = ["employee", "manager", "instructor", "admin"];
    if (!allowed.includes(role)) {
      return res.status(400).json({ message: "invalid role" });
    }

    await setUserRole(userId, role);
    res.status(200).json({ message: "User role updated" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /users
 * Admin: create user
 */
const createUserController = async (req, res) => {
  try {
    const { name, email, role } = req.body;

    if (!name || !email || !role) {
      return res
        .status(400)
        .json({ message: "name, email and role are required" });
    }

    const allowed = ["employee", "manager", "instructor", "admin"];
    if (!allowed.includes(role)) {
      return res.status(400).json({ message: "invalid role" });
    }

    const result = await createUser({
      name,
      email,
      role,
    });

    res
      .status(201)
      .json({
        message: "User created",
        userId: result.userId,
        password: result.password,
      });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getMyProfile,
  getAllUsers,
  updateUserStatus,
  updateUserRole,
  createUser: createUserController,
};
