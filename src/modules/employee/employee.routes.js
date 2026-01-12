const express = require("express");

const authMiddleware = require("../../middleware/auth.middleware");

const {
  summary,
  lastCourse,
  urgentActions,
  certificates,
  allCourses,
  myCourses,
  courseDetails,
  lessonDetails,
  completeLesson,
  enrollCourse,
} = require("./employee.controller");

const router = express.Router();

/* =========================
   DASHBOARD
========================= */
router.get("/dashboard/summary", authMiddleware, summary);
router.get("/dashboard/last-course", authMiddleware, lastCourse);
router.get("/dashboard/urgent-actions", authMiddleware, urgentActions);
router.get("/dashboard/certificates", authMiddleware, certificates);

/* =========================
   COURSES
========================= */
router.get("/courses", authMiddleware, allCourses);
router.get("/my-courses", authMiddleware, myCourses);
router.post("/course/:courseId/enroll", authMiddleware, enrollCourse);

/* =========================
   COURSE DETAILS
========================= */
router.get("/course/:id", authMiddleware, courseDetails);

/* =========================
   LESSONS
========================= */
router.get("/course/:courseId/lesson/:lessonId", authMiddleware, lessonDetails);

router.post(
  "/course/:courseId/lesson/:lessonId/complete",
  authMiddleware,
  completeLesson
);

module.exports = router;
