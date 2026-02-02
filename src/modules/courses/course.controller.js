const {
  createCourseWithDocx,
  fetchAssignedCoursesForUser,
  fetchCourseContentForEmployee,
  fetchCourseContentForAdmin,
  saveCourseContentForAdmin,
  assignCourse,
  fetchAssignedUserIdsForCourse,
  fetchTotalAssignmentsCount,
  fetchCourseCatalog,
  fetchEnrolledUsersForCourse,
  unassignUserFromCourse,
  fetchCompletedUsersForCourse,
  deleteCourseFully,
} = require("./course.service");

/**
 * POST /courses
 * Admin / Manager / Instructor
 */
const createCourse = async (req, res) => {
  try {
    const { title, category, duration, description } = req.body;

    if (!title || !req.file) {
      return res.status(400).json({
        message: "Title and DOCX file are required",
      });
    }

    const result = await createCourseWithDocx({
      title,
      category,
      duration,
      description,
      createdBy: req.user.id,
      docxBuffer: req.file.buffer,
    });

    res.status(201).json({
      message: "Course created successfully",
      courseId: result.courseId,
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

/**
 * GET /courses/my
 * Employee
 */
const getMyAssignedCourses = async (req, res) => {
  try {
    const courses = await fetchAssignedCoursesForUser(req.user.id);
    res.status(200).json(courses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /courses/:courseId/content
 * Employee
 */
const getCourseContentForEmployee = async (req, res) => {
  try {
    const content = await fetchCourseContentForEmployee(
      req.params.courseId,
      req.user.id,
    );
    res.status(200).json(content);
  } catch (err) {
    res.status(403).json({ message: err.message });
  }
};

/**
 * GET /courses/:courseId/content-admin
 * Admin / Manager / Instructor - returns full structured content without assignment check
 */
const getCourseContentForAdmin = async (req, res) => {
  try {
    const content = await fetchCourseContentForAdmin(req.params.courseId);
    res.status(200).json(content);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PATCH /courses/:courseId/content
 * Admin / Manager / Instructor - persist full course content (modules/chapters + quiz)
 */
const saveCourseContent = async (req, res) => {
  try {
    const { modules, quiz } = req.body;
    const userId = req.user.id;
    const courseId = req.params.courseId;

    if (!Array.isArray(modules)) {
      return res.status(400).json({ message: "modules must be an array" });
    }

    // Save modules
    await saveCourseContentForAdmin(courseId, modules);

    // Handle quiz - either save or delete
    try {
      const quizService = require("../quiz/quiz.service");

      // First, check if there's an existing quiz for this course
      const existingQuiz = await quizService.getQuizByCourse(
        parseInt(courseId),
      );

      if (!quiz || !quiz.title) {
        // Quiz is being deleted (quiz is null or has no title)
        if (existingQuiz && existingQuiz.id) {
          console.log(
            "🗑️  Deleting quiz for courseId:",
            courseId,
            "quizId:",
            existingQuiz.id,
          );
          await quizService.deleteQuiz(existingQuiz.id);
          console.log("✅ Quiz deleted successfully");
        }
      } else {
        // Quiz is being saved or updated
        console.log("Attempting to save quiz for courseId:", courseId);
        const quizResult = await quizService.createOrUpdateQuiz({
          courseId: parseInt(courseId),
          title: quiz.title,
          description: quiz.description || null,
          passingScore: quiz.passingScore || 60,
          timeLimit: quiz.timeLimit || null,
          showResults: quiz.showResults !== false,
          showCorrectAnswers: quiz.showCorrectAnswers !== false,
          questions: (quiz.questions || []).map((q) => ({
            question: q.question,
            explanation: q.explanation || null,
            options: (q.options || []).map((opt) => ({
              text: opt.text,
              isCorrect: opt.isCorrect,
            })),
          })),
          createdBy: userId,
        });
        console.log("✅ Quiz saved successfully:", quizResult);
      }
    } catch (quizErr) {
      console.error(
        "❌ Quiz operation failed:",
        quizErr.message,
        quizErr.stack,
      );
      // Don't fail the entire request if quiz operation fails
    }

    res.status(200).json({ message: "Course content saved successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /courses/:courseId/assign
 * Admin / Manager
 */
const assignCourseToUsers = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { userIds, assignmentType } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        message: "userIds must be a non-empty array",
      });
    }

    if (!["mandatory", "optional"].includes(assignmentType)) {
      return res.status(400).json({
        message: "assignmentType must be mandatory or optional",
      });
    }

    await assignCourse({
      courseId,
      userIds,
      assignmentType,
      assignedBy: req.user.id,
    });

    res.status(200).json({
      message: "Course assigned successfully",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /courses/:courseId/assignees
 * Admin / Manager / Instructor - return list of userIds already assigned
 */
const getAssignedUsersForCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userIds = await fetchAssignedUserIdsForCourse(courseId);
    res.status(200).json({ userIds });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /courses/assignments/count
 * Admin / Manager - return total assignments count
 */
const getTotalAssignmentsCount = async (req, res) => {
  try {
    const total = await fetchTotalAssignmentsCount();
    res.status(200).json({ total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /courses/catalog
 * Admin / Manager
 */
const getCourseCatalog = async (req, res) => {
  try {
    const courses = await fetchCourseCatalog();
    res.status(200).json(courses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /courses/:courseId/enrolled-users
 * Admin / Manager / Instructor - return list of enrolled users with details
 */
const getEnrolledUsers = async (req, res) => {
  try {
    const { courseId } = req.params;
    const users = await fetchEnrolledUsersForCourse(courseId);
    res.status(200).json({ users });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /courses/:courseId/completed-users
 * Admin / Manager / Instructor - return list of completed users with details (read-only)
 */
const getCompletedUsers = async (req, res) => {
  try {
    const { courseId } = req.params;
    const users = await fetchCompletedUsersForCourse(courseId);
    res.status(200).json({ users });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * DELETE /courses/:courseId/users/:userId
 * Admin / Manager - unassign user from course
 */
const unassignUser = async (req, res) => {
  try {
    const { courseId, userId } = req.params;

    if (!courseId || !userId) {
      return res.status(400).json({
        message: "courseId and userId are required",
      });
    }

    await unassignUserFromCourse(courseId, userId);

    res.status(200).json({
      message: "User unassigned successfully",
    });
  } catch (err) {
    if (err.message === "Assignment not found") {
      return res.status(404).json({ message: err.message });
    }
    res.status(500).json({ message: err.message });
  }
};

/**
 * DELETE /courses/:courseId
 * Admin / Manager - delete entire course
 */
const deleteCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    if (!courseId) {
      return res.status(400).json({
        message: "courseId is required",
      });
    }

    await deleteCourseFully(courseId);

    res.status(200).json({
      message: "Course deleted successfully",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createCourse,
  getMyAssignedCourses,
  getCourseContentForEmployee,
  assignCourseToUsers,
  getCourseCatalog,
  getCourseContentForAdmin,
  saveCourseContent,
  getAssignedUsersForCourse,
  getTotalAssignmentsCount,
  getEnrolledUsers,
  unassignUser,
  getCompletedUsers,
  deleteCourse,
};
