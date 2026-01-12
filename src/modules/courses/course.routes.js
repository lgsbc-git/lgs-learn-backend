const express = require("express");
const multer = require("multer");

const authMiddleware = require("../../middleware/auth.middleware");
const roleMiddleware = require("../../middleware/role.middleware");

const {
  createCourse,
  getMyAssignedCourses,
  getCourseContentForEmployee,
  getCourseContentForAdmin,
  saveCourseContent,
  assignCourseToUsers,
  getCourseCatalog,
} = require("./course.controller");

console.log({
  createCourse,
  getMyAssignedCourses,
  getCourseContentForEmployee,
  assignCourseToUsers,
});

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype !==
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      return cb(new Error("Only DOCX files allowed"));
    }
    cb(null, true);
  },
});

/**
 * Create course
 */
router.post(
  "/",
  authMiddleware,
  roleMiddleware("admin", "manager", "instructor"),
  upload.single("docx"),
  createCourse
);

/**
 * Employee: assigned courses
 */
router.get(
  "/my",
  authMiddleware,
  roleMiddleware("employee"),
  getMyAssignedCourses
);

/**
 * Employee: course content
 */
router.get(
  "/:courseId/content",
  authMiddleware,
  roleMiddleware("employee"),
  getCourseContentForEmployee
);
/**
 * Admin: full course content (no assignment check)
 */
router.get(
  "/:courseId/content-admin",
  authMiddleware,
  roleMiddleware("admin", "manager", "instructor"),
  getCourseContentForAdmin
);

/**
 * Admin: persist course content
 */
router.patch(
  "/:courseId/content",
  authMiddleware,
  roleMiddleware("admin", "manager", "instructor"),
  saveCourseContent
);
/**
 * Assign course to employees
 * Admin / Manager
 */
router.post(
  "/:courseId/assign",
  authMiddleware,
  roleMiddleware("admin", "manager"),
  assignCourseToUsers
);

/**
 * Total assignments count
 */
router.get(
  "/assignments/count",
  authMiddleware,
  roleMiddleware("admin", "manager"),
  (req, res) => require("./course.controller").getTotalAssignmentsCount(req, res)
);

/**
 * Get assigned users for a course
 */
router.get(
  "/:courseId/assignees",
  authMiddleware,
  roleMiddleware("admin", "manager", "instructor"),
  (req, res) => {
    // controller will handle
    return require("./course.controller").getAssignedUsersForCourse(req, res);
  }
);
/**
 * Course catalog (Admin / Manager)
 */
router.get(
  "/catalog",
  authMiddleware,
  roleMiddleware("admin", "manager"),
  getCourseCatalog
);

module.exports = router;
