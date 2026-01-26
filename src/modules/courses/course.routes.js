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
  getEnrolledUsers,
  unassignUser,
  getCompletedUsers,
  deleteCourse,
} = require("./course.controller");

const { uploadChapterMedia } = require("./media.controller");

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

// Media upload for images and videos (larger file size limit)
const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB for media files
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "video/mp4",
      "video/webm",
      "video/quicktime",
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(
        new Error(
          "Only image (JPEG, PNG, GIF, WebP) and video (MP4, WebM, MOV) files allowed",
        ),
      );
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
  createCourse,
);

/**
 * Employee: assigned courses
 */
router.get(
  "/my",
  authMiddleware,
  roleMiddleware("employee"),
  getMyAssignedCourses,
);

/**
 * Employee: course content
 */
router.get(
  "/:courseId/content",
  authMiddleware,
  roleMiddleware("employee"),
  getCourseContentForEmployee,
);
/**
 * Admin: full course content (no assignment check)
 */
router.get(
  "/:courseId/content-admin",
  authMiddleware,
  roleMiddleware("admin", "manager", "instructor"),
  getCourseContentForAdmin,
);

/**
 * Admin: persist course content
 */
router.patch(
  "/:courseId/content",
  authMiddleware,
  roleMiddleware("admin", "manager", "instructor"),
  saveCourseContent,
);
/**
 * Assign course to employees
 * Admin / Manager
 */
router.post(
  "/:courseId/assign",
  authMiddleware,
  roleMiddleware("admin", "manager"),
  assignCourseToUsers,
);

/**
 * Total assignments count
 */
router.get(
  "/assignments/count",
  authMiddleware,
  roleMiddleware("admin", "manager"),
  (req, res) =>
    require("./course.controller").getTotalAssignmentsCount(req, res),
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
  },
);

/**
 * Get enrolled users for a course with details (Admin / Manager / Instructor)
 */
router.get(
  "/:courseId/enrolled-users",
  authMiddleware,
  roleMiddleware("admin", "manager", "instructor"),
  getEnrolledUsers,
);

/**
 * Get completed users for a course with details (read-only) (Admin / Manager / Instructor)
 */
router.get(
  "/:courseId/completed-users",
  authMiddleware,
  roleMiddleware("admin", "manager", "instructor"),
  getCompletedUsers,
);

/**
 * Unassign user from course (Admin / Manager / Instructor)
 */
router.delete(
  "/:courseId/users/:userId",
  authMiddleware,
  roleMiddleware("admin", "manager", "instructor"),
  unassignUser,
);

/**
 * Delete course
 */
router.delete(
  "/:courseId",
  authMiddleware,
  roleMiddleware("admin", "manager"),
  deleteCourse,
);

/**
 * Course catalog (Admin / Manager / Instructor)
 */
router.get(
  "/catalog",
  authMiddleware,
  roleMiddleware("admin", "manager", "instructor"),
  getCourseCatalog,
);

/**
 * Upload media (image/video) to chapter
 */
router.post(
  "/:courseId/chapters/:chapterId/media",
  authMiddleware,
  roleMiddleware("admin", "manager", "instructor"),
  mediaUpload.single("file"),
  uploadChapterMedia,
);

module.exports = router;
