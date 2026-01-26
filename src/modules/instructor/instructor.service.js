const { getDbPool } = require("../../config/db");

/**
 * Fetch count of courses created by a specific instructor
 */
const fetchInstructorCoursesCount = async (instructorId) => {
  const pool = await getDbPool();

  const result = await pool.request().input("instructorId", instructorId)
    .query(`
      SELECT COUNT(*) AS count
      FROM Courses
      WHERE createdBy = @instructorId
    `);

  return result.recordset[0]?.count || 0;
};

/**
 * Fetch total count of active courses in the LMS
 */
const fetchTotalActiveCoursesCount = async () => {
  const pool = await getDbPool();

  const result = await pool.request().query(`
    SELECT COUNT(DISTINCT id) AS count
    FROM Courses
  `);

  return result.recordset[0]?.count || 0;
};

module.exports = {
  fetchInstructorCoursesCount,
  fetchTotalActiveCoursesCount,
};
