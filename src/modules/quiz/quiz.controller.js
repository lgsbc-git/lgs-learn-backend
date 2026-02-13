const quizService = require("./quiz.service");

/**
 * INSTRUCTOR: Create/Update quiz for course
 * POST /api/courses/:courseId/quiz
 */
const saveQuiz = async (req, res) => {
  try {
    const { courseId } = req.params;
    const {
      title,
      description,
      passingScore,
      timeLimit,
      showResults,
      showCorrectAnswers,
      questions,
    } = req.body;
    const userId = req.user.id;

    if (!title || !questions || questions.length === 0) {
      return res
        .status(400)
        .json({ error: "Title and questions are required" });
    }

    const result = await quizService.createOrUpdateQuiz({
      courseId: parseInt(courseId),
      title,
      description,
      passingScore: passingScore || 60,
      timeLimit,
      showResults: showResults !== false,
      showCorrectAnswers: showCorrectAnswers !== false,
      questions,
      createdBy: userId,
    });

    res.json({ success: true, ...result });
  } catch (err) {
    console.error("Save quiz error:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET quiz by course
 * GET /api/courses/:courseId/quiz
 */
const getQuizByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    console.log("🔍 GET /courses/:courseId/quiz - courseId:", courseId);
    const quiz = await quizService.getQuizByCourse(parseInt(courseId));
    console.log("Quiz result:", quiz);

    if (!quiz) {
      console.log("⚠️  No quiz found for courseId:", courseId);
      return res.json({ quiz: null, message: "No quiz created yet" });
    }

    console.log("✅ Quiz found and returning");
    res.json({ quiz });
  } catch (err) {
    console.error("❌ Get quiz error:", err.message, err.stack);
    res.status(500).json({ error: err.message });
  }
};

/**
 * INSTRUCTOR: Delete quiz
 * DELETE /api/quizzes/:quizId
 */
const deleteQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    await quizService.deleteQuiz(parseInt(quizId));
    res.json({ success: true, message: "Quiz deleted" });
  } catch (err) {
    console.error("Delete quiz error:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * EMPLOYEE: Check if can take quiz
 * GET /api/courses/:courseId/quiz/can-attempt
 */
const checkCanAttempt = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    const canAttempt = await quizService.canAttemptQuiz(
      parseInt(courseId),
      userId,
    );
    res.json({ canAttempt });
  } catch (err) {
    console.error("Check attempt error:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * EMPLOYEE: Submit quiz answers
 * POST /api/quizzes/:quizId/submit
 */
const submitQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    const { answers, timeTaken } = req.body;
    const userId = req.user.id;

    console.log(
      `📝 Quiz Submission - quizId: ${quizId}, userId: ${userId}, answers: ${answers.length}, timeTaken: ${timeTaken}s`,
    );

    // Answers can be empty if time expires without answering - this is valid
    if (answers === undefined || answers === null) {
      return res
        .status(400)
        .json({ error: "Invalid submission: answers field required" });
    }

    const result = await quizService.submitQuizAnswers(
      parseInt(quizId),
      userId,
      answers,
      timeTaken || 0,
    );

    console.log(`✅ Quiz submitted successfully - Score: ${result.score}%`);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("Submit quiz error:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * EMPLOYEE: Get quiz results
 * GET /api/quiz-submissions/:submissionId
 */
const getQuizResults = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const results = await quizService.getQuizResults(parseInt(submissionId));
    res.json(results);
  } catch (err) {
    console.error("Get results error:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * EMPLOYEE: Get quiz attempt history
 * GET /api/courses/:courseId/quiz/history
 */
const getQuizHistory = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;
    const history = await quizService.getUserQuizHistory(
      parseInt(courseId),
      userId,
    );
    res.json({ history });
  } catch (err) {
    console.error("Get history error:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * INSTRUCTOR/ADMIN: Get quiz submissions for a course
 * GET /api/courses/:courseId/quiz/submissions
 * Returns all submissions for quizzes in this course
 */
const getCourseQuizSubmissions = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // For instructors, verify they own the course
    if (userRole === "instructor") {
      const pool = await require("../../config/db").getDbPool();
      const req_check = pool.request();
      const courseOwner = await req_check
        .input("courseId", require("../../config/db").sql.Int, courseId)
        .input("instructorId", require("../../config/db").sql.Int, userId)
        .query(
          `SELECT id FROM Courses WHERE id = @courseId AND createdBy = @instructorId`,
        );

      if (courseOwner.recordset.length === 0) {
        return res.status(403).json({
          error: "You can only view submissions for your own courses",
        });
      }
    }

    const submissions = await quizService.getCourseQuizSubmissions(courseId);
    res.json({ submissions });
  } catch (err) {
    console.error("Get course submissions error:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * INSTRUCTOR/ADMIN: Get all quiz submissions (admin only)
 * GET /api/quiz/submissions/all
 * Returns all quiz submissions in the system
 */
const getAllQuizSubmissions = async (req, res) => {
  try {
    const submissions = await quizService.getAllQuizSubmissions();
    res.json({ submissions });
  } catch (err) {
    console.error("Get all submissions error:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Get detailed submission with all answers
 * GET /api/quiz/submissions/:submissionId
 * Returns submission details with all answers, evaluation status (Pass/Fail)
 */
const getSubmissionDetails = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const details = await quizService.getSubmissionDetails(
      parseInt(submissionId),
    );
    res.json(details);
  } catch (err) {
    console.error("Get submission details error:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Check if employee can attempt quiz (not attempted before)
 * GET /api/quizzes/:quizId/check-attempt
 * Returns whether user can attempt the quiz
 */
const checkQuizAttempt = async (req, res) => {
  try {
    const { quizId } = req.params;
    const userId = req.user.id;
    const result = await quizService.checkQuizAttempt(parseInt(quizId), userId);
    res.json(result);
  } catch (err) {
    console.error("Check quiz attempt error:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * ============ STAFF APPROVAL WORKFLOW ============
 */

/**
 * Get full submission details for staff review
 * GET /api/submissions/:submissionId/full
 * Returns complete submission with all answers and correct answers
 */
const getFullSubmissionDetails = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const details = await quizService.getFullSubmissionDetails(
      parseInt(submissionId),
    );
    res.json(details);
  } catch (err) {
    console.error("Get full submission details error:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Approve a quiz submission for certification
 * PATCH /api/submissions/:submissionId/approve
 * Marks submission as approved, allowing certificate to be issued
 */
const approveSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const staffUserId = req.user.id;

    // Verify user has staff role
    if (!["admin", "instructor", "manager"].includes(req.user.role)) {
      return res
        .status(403)
        .json({ error: "Only staff can approve submissions" });
    }

    const result = await quizService.approveSubmission(
      parseInt(submissionId),
      staffUserId,
    );
    res.json(result);
  } catch (err) {
    console.error("Approve submission error:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Reject a quiz submission
 * PATCH /api/submissions/:submissionId/reject
 * Deletes submission, employee must retake quiz
 */
const rejectSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { rejectionReason } = req.body;
    const staffUserId = req.user.id;

    // Verify user has staff role
    if (!["admin", "instructor", "manager"].includes(req.user.role)) {
      return res
        .status(403)
        .json({ error: "Only staff can reject submissions" });
    }

    if (!rejectionReason) {
      return res.status(400).json({ error: "Rejection reason is required" });
    }

    const result = await quizService.rejectSubmission(
      parseInt(submissionId),
      staffUserId,
      rejectionReason,
    );
    res.json(result);
  } catch (err) {
    console.error("Reject submission error:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Reset quiz attempts for an employee
 * PATCH /submissions/:submissionId/reset-attempts
 * Staff only
 */
const resetQuizAttempts = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const staffUserId = req.user.id;

    // Verify user has staff role
    if (!["admin", "instructor", "manager"].includes(req.user.role)) {
      return res
        .status(403)
        .json({ error: "Only staff can reset quiz attempts" });
    }

    const result = await quizService.resetQuizAttempts(
      parseInt(submissionId),
      staffUserId,
    );
    res.json(result);
  } catch (err) {
    console.error("Reset attempts error:", err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  saveQuiz,
  getQuizByCourse,
  deleteQuiz,
  checkCanAttempt,
  submitQuiz,
  getQuizResults,
  getQuizHistory,
  getCourseQuizSubmissions,
  getAllQuizSubmissions,
  getSubmissionDetails,
  checkQuizAttempt,
  getFullSubmissionDetails,
  approveSubmission,
  rejectSubmission,
  resetQuizAttempts,
};
