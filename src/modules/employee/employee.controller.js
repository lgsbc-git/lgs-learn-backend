const { getDbPool } = require("../../config/db");

/* =========================
   DASHBOARD
========================= */
exports.summary = async (req, res) => {
  try {
    const userId = req.user.id;
    const pool = await getDbPool();

    const result = await pool.request().input("userId", userId).query(`
      SELECT
        COUNT(DISTINCT ca.courseId) AS coursesEnrolled,
        COUNT(DISTINCT lp.chapterId) AS lessonsCompleted,
        COUNT(DISTINCT ch.id) AS totalLessons
      FROM CourseAssignments ca
      JOIN Courses c ON c.id = ca.courseId
      LEFT JOIN CourseModules m ON m.courseId = c.id
      LEFT JOIN CourseChapters ch ON ch.moduleId = m.id
      LEFT JOIN LessonProgress lp 
        ON lp.chapterId = ch.id 
        AND lp.userId = ca.userId
        AND lp.completed = 1
      WHERE ca.userId = @userId
    `);

    const row = result.recordset[0];

    // compute remaining mandatory courses: mandatory assigned courses where progress < 100%
    const remainingRes = await pool.request().input("userId", userId).query(`
      SELECT COUNT(*) AS remainingMandatory
      FROM (
        SELECT c.id,
          COUNT(DISTINCT ch.id) AS totalLessons,
          COUNT(DISTINCT CASE WHEN lp.completed = 1 AND lp.userId = @userId THEN ch.id END) AS completedLessons
        FROM CourseAssignments ca
        JOIN Courses c ON c.id = ca.courseId
        LEFT JOIN CourseModules m ON m.courseId = c.id
        LEFT JOIN CourseChapters ch ON ch.moduleId = m.id
        LEFT JOIN LessonProgress lp ON lp.chapterId = ch.id AND lp.userId = @userId
        WHERE ca.userId = @userId AND ca.assignmentType = 'mandatory'
        GROUP BY c.id
      ) t
      WHERE totalLessons > 0 AND completedLessons < totalLessons
    `);

    const remainingMandatory =
      remainingRes.recordset[0]?.remainingMandatory || 0;

    res.json({
      learningHours: Math.floor((row.lessonsCompleted || 0) * 0.5),
      remainingMandatoryCourses: remainingMandatory,
      coursesEnrolled: row.coursesEnrolled || 0,
      coursesCompleted:
        row.totalLessons > 0 && row.lessonsCompleted === row.totalLessons
          ? row.coursesEnrolled
          : 0,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.lastCourse = async (req, res) => {
  try {
    const userId = req.user.id;
    const pool = await getDbPool();

    // First, get the most recent course with progress
    const recentResult = await pool.request().input("userId", userId).query(`
      SELECT TOP 1
        c.id
      FROM LessonProgress lp
      JOIN CourseChapters ch ON ch.id = lp.chapterId
      JOIN CourseModules m ON m.id = ch.moduleId
      JOIN Courses c ON c.id = m.courseId
      WHERE lp.userId = @userId
      ORDER BY lp.updatedAt DESC
    `);

    if (recentResult.recordset.length === 0) {
      return res.json(null);
    }

    const courseId = recentResult.recordset[0].id;

    // Then, get all lessons in that course and count completed ones
    const progressResult = await pool
      .request()
      .input("userId", userId)
      .input("courseId", courseId).query(`
      SELECT
        c.id AS courseId,
        c.title,
        COUNT(DISTINCT ch.id) AS totalLessons,
        COUNT(DISTINCT CASE WHEN lp.completed = 1 AND lp.userId = @userId THEN ch.id END) AS completedLessons
      FROM Courses c
      JOIN CourseModules m ON m.courseId = c.id
      JOIN CourseChapters ch ON ch.moduleId = m.id
      LEFT JOIN LessonProgress lp ON lp.chapterId = ch.id AND lp.userId = @userId
      WHERE c.id = @courseId
      GROUP BY c.id, c.title
    `);

    if (progressResult.recordset.length === 0) {
      return res.json(null);
    }

    const record = progressResult.recordset[0];
    res.json({
      courseId: record.courseId,
      title: record.title,
      progress:
        record.totalLessons > 0
          ? Math.round((record.completedLessons / record.totalLessons) * 100)
          : 0,
      resumeFromSeconds: 0,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.urgentActions = async (req, res) => {
  try {
    const userId = req.user.id;
    const pool = await getDbPool();

    const result = await pool.request().input("userId", userId).query(`
      SELECT
        c.id AS courseId,
        c.title,
        ca.dueDate AS deadline,
        DATEDIFF(day, GETDATE(), ca.dueDate) AS daysLeft
      FROM CourseAssignments ca
      JOIN Courses c ON c.id = ca.courseId
      WHERE ca.userId = @userId
        AND ca.assignmentType = 'mandatory'
        -- only include assignments whose deadline is within the next 0..5 days
        AND DATEDIFF(day, GETDATE(), ca.dueDate) BETWEEN 0 AND 5
    `);

    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.certificates = async (req, res) => {
  try {
    const userId = req.user.id;
    const pool = await getDbPool();

    const result = await pool.request().input("userId", userId).query(`
      SELECT
        c.id AS courseId,
        c.title AS courseTitle,
        ts.status,
        ts.evaluatedAt
      FROM TestSubmissions ts
      JOIN Courses c ON c.id = ts.courseId
      WHERE ts.userId = @userId
        AND ts.status = 'pass'
    `);

    res.json(
      result.recordset.map((row) => ({
        courseId: row.courseId,
        courseTitle: row.courseTitle,
        status: row.status, // always 'pass'
        certificateUrl: `/certificates/${row.courseId}/${userId}.pdf`,
      }))
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =========================
   COURSES
========================= */
exports.allCourses = async (req, res) => {
  try {
    const userId = req.user.id;
    const pool = await getDbPool();

    const result = await pool.request().input("userId", userId).query(`
      SELECT
        c.id,
        c.title,
        c.category,
        c.duration,
        CASE WHEN ca.id IS NULL THEN 0 ELSE 1 END AS enrolled,
        CASE WHEN ca.assignmentType = 'mandatory' THEN 1 ELSE 0 END AS mandatory
      FROM Courses c
      LEFT JOIN CourseAssignments ca 
        ON ca.courseId = c.id AND ca.userId = @userId
    `);

    res.json(
      result.recordset.map((c) => ({
        ...c,
        enrolled: Boolean(c.enrolled),
        mandatory: Boolean(c.mandatory),
      }))
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.myCourses = async (req, res) => {
  try {
    const userId = req.user.id;
    const pool = await getDbPool();

    const result = await pool.request().input("userId", userId).query(`
      SELECT
        c.id,
        c.title,
        c.category,
        COUNT(DISTINCT ch.id) AS totalLessons,
        COUNT(DISTINCT CASE WHEN lp.completed = 1 THEN ch.id END) AS completedLessons
      FROM CourseAssignments ca
      JOIN Courses c ON c.id = ca.courseId
      LEFT JOIN CourseModules m ON m.courseId = c.id
      LEFT JOIN CourseChapters ch ON ch.moduleId = m.id
      LEFT JOIN LessonProgress lp 
        ON lp.chapterId = ch.id AND lp.userId = ca.userId
      WHERE ca.userId = @userId
      GROUP BY c.id, c.title, c.category
    `);

    res.json(
      result.recordset.map((c) => ({
        id: c.id,
        title: c.title,
        category: c.category,
        progress:
          c.totalLessons > 0
            ? Math.round((c.completedLessons / c.totalLessons) * 100)
            : 0,
        completed: c.totalLessons > 0 && c.completedLessons >= c.totalLessons,
      }))
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =========================
   ENROLL COURSE
========================= */
exports.enrollCourse = async (req, res) => {
  try {
    const userId = req.user.id;
    const { courseId } = req.params;
    const { assignmentType = "optional", dueDate = null } = req.body || {};
    const pool = await getDbPool();

    // Check if already enrolled
    const checkResult = await pool
      .request()
      .input("userId", userId)
      .input("courseId", courseId).query(`
      SELECT id FROM CourseAssignments
      WHERE userId = @userId AND courseId = @courseId
    `);

    if (checkResult.recordset.length > 0) {
      return res
        .status(400)
        .json({ message: "Already enrolled in this course" });
    }

    // Enroll the user (allow dueDate to be null when self-enrolling)
    await pool
      .request()
      .input("userId", userId)
      .input("courseId", courseId)
      .input("assignmentType", assignmentType)
      .input("dueDate", dueDate).query(`
      INSERT INTO CourseAssignments (userId, courseId, assignmentType, assignedAt, dueDate)
      VALUES (@userId, @courseId, @assignmentType, GETDATE(), @dueDate)
    `);

    res.json({
      success: true,
      message: "Successfully enrolled in course",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =========================
   COURSE DETAILS
========================= */
exports.courseDetails = async (req, res) => {
  try {
    const courseId = req.params.courseId || req.params.id;
    const userId = req.user.id;

    const pool = await getDbPool();

    const result = await pool
      .request()
      .input("courseId", courseId)
      .input("userId", userId).query(`
        SELECT
          m.id AS moduleId,
          m.title AS moduleTitle,
          m.moduleOrder,

          ch.id AS lessonId,
          ch.title AS lessonTitle,
          ch.chapterOrder,

          cc.content AS lessonContent,

          ISNULL(lp.completed, 0) AS completed
        FROM CourseModules m
        JOIN CourseChapters ch ON ch.moduleId = m.id
        LEFT JOIN ChapterContents cc ON cc.chapterId = ch.id
        LEFT JOIN LessonProgress lp
          ON lp.chapterId = ch.id AND lp.userId = @userId
        WHERE m.courseId = @courseId
        ORDER BY m.moduleOrder, ch.chapterOrder
      `);

    const modulesMap = {};

    for (const row of result.recordset) {
      if (!modulesMap[row.moduleId]) {
        modulesMap[row.moduleId] = {
          id: row.moduleId,
          title: row.moduleTitle,
          lessons: [],
        };
      }

      modulesMap[row.moduleId].lessons.push({
        id: row.lessonId,
        title: row.lessonTitle,
        content: row.lessonContent || "", // ✅ CRITICAL LINE
        completed: Boolean(row.completed),
      });
    }

    res.json({
      id: courseId,
      modules: Object.values(modulesMap),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =========================
   LESSONS
========================= */
exports.lessonDetails = async (req, res) => {
  try {
    const { lessonId } = req.params;
    const pool = await getDbPool();

    const result = await pool.request().input("lessonId", lessonId).query(`
      SELECT content
      FROM ChapterContents
      WHERE chapterId = @lessonId
    `);

    res.json({
      id: lessonId,
      content: result.recordset[0]?.content || "",
      completed: false,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.completeLesson = async (req, res) => {
  try {
    const { lessonId } = req.params;
    const userId = req.user.id;
    const pool = await getDbPool();

    await pool.request().input("lessonId", lessonId).input("userId", userId)
      .query(`
        MERGE LessonProgress AS target
        USING (SELECT @lessonId AS chapterId, @userId AS userId) AS src
        ON target.chapterId = src.chapterId AND target.userId = src.userId
        WHEN MATCHED THEN UPDATE SET completed = 1, updatedAt = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (chapterId, userId, completed, updatedAt)
          VALUES (@lessonId, @userId, 1, GETDATE());
      `);

    res.json({
      success: true,
      message: "Lesson marked as completed",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
