const {
  fetchInstructorCoursesCount,
  fetchTotalActiveCoursesCount,
} = require("./instructor.service");

/**
 * GET /instructor/dashboard/summary
 * Instructor: Get dashboard summary (courses created, total active courses, evaluations pending)
 */
const getInstructorSummary = async (req, res) => {
  try {
    const instructorId = req.user.id;

    // Get courses created by this instructor
    const coursesCreated = await fetchInstructorCoursesCount(instructorId);

    // Get total active courses in the LMS
    const activeCourses = await fetchTotalActiveCoursesCount();

    // Evaluations pending is 0 for now (not implemented)
    const evaluationsPending = 0;

    res.status(200).json({
      coursesCreated,
      activeCourses,
      evaluationsPending,
    });
  } catch (err) {
    console.error("Error fetching instructor summary:", err);
    res.status(500).json({
      message: "Failed to fetch instructor summary",
      error: err.message,
    });
  }
};

module.exports = {
  getInstructorSummary,
};
