const express = require("express");

const authMiddleware = require("../../middleware/auth.middleware");
const roleMiddleware = require("../../middleware/role.middleware");

const {
  summary,
  teamProgress,
  pendingEvaluations,
  recentActivity,
  myTeam,
  teamQuizSubmissions,
} = require("./manager.controller");

const {
  getAllTeams,
  createTeam,
  getTeamDetails,
  updateTeam,
  deleteTeam,
  addTeamMembers,
  removeTeamMembers,
  getAvailableEmployees,
  getAllEmployees,
  updateMemberRole,
} = require("./team.controller");

const router = express.Router();

/* =========================
   DASHBOARD
========================= */
router.get(
  "/dashboard/summary",
  authMiddleware,
  roleMiddleware("manager"),
  summary,
);

router.get(
  "/team/progress",
  authMiddleware,
  roleMiddleware("manager"),
  teamProgress,
);

router.get(
  "/evaluations/pending",
  authMiddleware,
  roleMiddleware("manager"),
  pendingEvaluations,
);

router.get(
  "/evaluations/quiz-submissions",
  authMiddleware,
  roleMiddleware("manager"),
  teamQuizSubmissions,
);

router.get(
  "/activity/recent",
  authMiddleware,
  roleMiddleware("manager"),
  recentActivity,
);

/* =========================
   TEAM MANAGEMENT - EMPLOYEES
========================= */
router.get("/team", authMiddleware, roleMiddleware("manager"), myTeam);

/* =========================
   TEAM MANAGEMENT - TEAMS
========================= */
router.get("/teams", authMiddleware, roleMiddleware("manager"), getAllTeams);

router.post("/teams", authMiddleware, roleMiddleware("manager"), createTeam);

router.get(
  "/teams/:teamId",
  authMiddleware,
  roleMiddleware("manager"),
  getTeamDetails,
);

router.put(
  "/teams/:teamId",
  authMiddleware,
  roleMiddleware("manager"),
  updateTeam,
);

router.delete(
  "/teams/:teamId",
  authMiddleware,
  roleMiddleware("manager"),
  deleteTeam,
);

router.post(
  "/teams/:teamId/add-members",
  authMiddleware,
  roleMiddleware("manager"),
  addTeamMembers,
);

router.delete(
  "/teams/:teamId/remove-members",
  authMiddleware,
  roleMiddleware("manager"),
  removeTeamMembers,
);

router.get(
  "/teams/:teamId/available-employees",
  authMiddleware,
  roleMiddleware("manager"),
  getAvailableEmployees,
);

router.get(
  "/employees",
  authMiddleware,
  roleMiddleware("manager"),
  getAllEmployees,
);

router.put(
  "/teams/:teamId/members/:userId/role",
  authMiddleware,
  roleMiddleware("manager"),
  updateMemberRole,
);

module.exports = router;
