const express = require("express");
const router = express.Router();
const quizController = require("./quiz.controller");
const authMiddleware = require("../../middleware/auth.middleware");
const roleMiddleware = require("../../middleware/role.middleware");

// ============ SPECIFIC ROUTES FIRST (before generic :courseId/:quizId routes) ============

// Admin: Get all quiz submissions
router.get(
  "/quiz/submissions/all",
  authMiddleware,
  roleMiddleware("admin"),
  quizController.getAllQuizSubmissions,
);

// Get detailed submission with all answers (manager/admin/instructor only)
router.get(
  "/submissions/:submissionId",
  authMiddleware,
  roleMiddleware("instructor", "admin", "manager"),
  quizController.getSubmissionDetails,
);

// Get full submission details with all questions and student answers (for staff evaluation)
router.get(
  "/submissions/:submissionId/full",
  authMiddleware,
  roleMiddleware("instructor", "admin", "manager"),
  quizController.getFullSubmissionDetails,
);

// Approve submission (staff only)
router.patch(
  "/submissions/:submissionId/approve",
  authMiddleware,
  roleMiddleware("instructor", "admin", "manager"),
  quizController.approveSubmission,
);

// Reject submission with reason (staff only)
router.patch(
  "/submissions/:submissionId/reject",
  authMiddleware,
  roleMiddleware("instructor", "admin", "manager"),
  quizController.rejectSubmission,
);

// Check if employee can attempt quiz (MUST be before /quizzes/:quizId routes)
router.get(
  "/quizzes/:quizId/check-attempt",
  authMiddleware,
  quizController.checkQuizAttempt,
);

// Employee: Submit quiz answers
router.post(
  "/quizzes/:quizId/submit",
  authMiddleware,
  quizController.submitQuiz,
);

// Delete quiz (instructor/admin only)
router.delete(
  "/quizzes/:quizId",
  authMiddleware,
  roleMiddleware("instructor", "admin"),
  quizController.deleteQuiz,
);

// ============ GENERIC ROUTES (after specific routes) ============

// Instructor: Create/Update quiz for course
router.post(
  "/:courseId/quiz",
  authMiddleware,
  roleMiddleware("instructor", "admin"),
  quizController.saveQuiz,
);

// Get quiz (any authenticated user)
router.get("/:courseId/quiz", authMiddleware, quizController.getQuizByCourse);

// Employee: Check if can attempt quiz (course-based check)
router.get(
  "/:courseId/quiz/can-attempt",
  authMiddleware,
  quizController.checkCanAttempt,
);

// Get quiz results for submission
router.get(
  "/:courseId/quiz/results/:submissionId",
  authMiddleware,
  quizController.getQuizResults,
);

// Employee: Get quiz attempt history
router.get(
  "/:courseId/quiz/history",
  authMiddleware,
  quizController.getQuizHistory,
);

// Instructor/Admin/Manager: Get submissions for specific course
router.get(
  "/:courseId/quiz/submissions",
  authMiddleware,
  roleMiddleware("instructor", "admin", "manager"),
  quizController.getCourseQuizSubmissions,
);

module.exports = router;
