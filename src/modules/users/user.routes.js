const express = require("express");
const authMiddleware = require("../../middleware/auth.middleware");
const roleMiddleware = require("../../middleware/role.middleware");
const {
  getMyProfile,
  getAllUsers,
  updateUserStatus,
  createUser,
} = require("./user.controller");

const router = express.Router();

/**
 * Logged-in user profile
 */
router.get("/me", authMiddleware, getMyProfile);

/**
 * Admin: list all users
 */
router.get("/", authMiddleware, roleMiddleware("admin"), getAllUsers);

/**
 * Admin: create new user
 */
router.post("/", authMiddleware, roleMiddleware("admin"), createUser);

/**
 * Admin: activate / deactivate user
 */
router.patch(
  "/:id/status",
  authMiddleware,
  roleMiddleware("admin"),
  updateUserStatus
);

/**
 * Admin: update user role
 */
router.patch(
  "/:id/role",
  authMiddleware,
  roleMiddleware("admin"),
  (req, res, next) =>
    require("./user.controller").updateUserRole(req, res, next)
);

module.exports = router;
