const express = require("express");
const authMiddleware = require("../../middleware/auth.middleware");
const roleMiddleware = require("../../middleware/role.middleware");

const { getInstructorSummary } = require("./instructor.controller");

const router = express.Router();

/**
 * GET /instructor/dashboard/summary
 * Instructor: Get dashboard summary
 */
router.get(
  "/dashboard/summary",
  authMiddleware,
  roleMiddleware("instructor"),
  getInstructorSummary,
);

module.exports = router;
