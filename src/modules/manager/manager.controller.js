const { getDbPool } = require("../../config/db");

/* =========================
   DASHBOARD SUMMARY
========================= */
exports.summary = async (req, res) => {
  try {
    const managerId = req.user.id;
    const pool = await getDbPool();

    // Get team size - count employees in all teams managed by current user
    const teamRes = await pool.request().input("managerId", managerId).query(`
      SELECT COUNT(DISTINCT tm.userId) AS teamSize
      FROM Teams t
      JOIN TeamMembers tm ON tm.teamId = t.id
      WHERE t.managerId = @managerId
    `);
    const teamSize = teamRes.recordset[0]?.teamSize || 0;

    // Get mandatory pending count - courses not completed by team members
    const mandatoryRes = await pool.request().input("managerId", managerId)
      .query(`
      SELECT COUNT(DISTINCT ca.id) AS mandatoryPending
      FROM CourseAssignments ca
      JOIN Courses c ON c.id = ca.courseId
      JOIN TeamMembers tm ON tm.userId = ca.userId
      JOIN Teams t ON t.id = tm.teamId
      WHERE t.managerId = @managerId 
        AND ca.assignmentType = 'mandatory'
        AND c.id NOT IN (
          SELECT DISTINCT courseId FROM TestSubmissions 
          WHERE userId = ca.userId AND status = 'pass'
        )
    `);
    const mandatoryPending = mandatoryRes.recordset[0]?.mandatoryPending || 0;

    // Get total courses assigned to team
    const coursesRes = await pool.request().input("managerId", managerId)
      .query(`
      SELECT COUNT(DISTINCT ca.courseId) AS coursesAssigned
      FROM CourseAssignments ca
      JOIN TeamMembers tm ON tm.userId = ca.userId
      JOIN Teams t ON t.id = tm.teamId
      WHERE t.managerId = @managerId
    `);
    const coursesAssigned = coursesRes.recordset[0]?.coursesAssigned || 0;

    // Get pending evaluations count
    const evaluationsRes = await pool.request().input("managerId", managerId)
      .query(`
      SELECT COUNT(*) AS evaluationsPending
      FROM TestSubmissions ts
      JOIN TeamMembers tm ON tm.userId = ts.userId
      JOIN Teams t ON t.id = tm.teamId
      WHERE t.managerId = @managerId AND ts.status = 'pending'
    `);
    const evaluationsPending =
      evaluationsRes.recordset[0]?.evaluationsPending || 0;

    // Calculate team completion percentage
    const completionRes = await pool.request().input("managerId", managerId)
      .query(`
      SELECT 
        COUNT(DISTINCT ca.id) AS totalAssignments,
        COUNT(DISTINCT CASE 
          WHEN ts.status = 'pass' THEN ca.id 
          ELSE NULL 
        END) AS completedAssignments
      FROM CourseAssignments ca
      JOIN TeamMembers tm ON tm.userId = ca.userId
      JOIN Teams t ON t.id = tm.teamId
      LEFT JOIN TestSubmissions ts ON ts.userId = ca.userId AND ts.courseId = ca.courseId
      WHERE t.managerId = @managerId
    `);
    const completion = completionRes.recordset[0];
    const teamCompletion =
      completion.totalAssignments > 0
        ? Math.round(
            (completion.completedAssignments / completion.totalAssignments) *
              100,
          )
        : 0;

    // Get overdue count
    const overdueRes = await pool.request().input("managerId", managerId)
      .query(`
      SELECT COUNT(DISTINCT ca.id) AS overdueCount
      FROM CourseAssignments ca
      JOIN Users u ON u.id = ca.userId
      JOIN TeamMembers tm ON tm.userId = u.id
      JOIN Teams t ON t.id = tm.teamId
      WHERE t.managerId = @managerId 
        AND ca.dueDate < GETDATE()
        AND ca.id NOT IN (
          SELECT DISTINCT ca2.id FROM CourseAssignments ca2
          JOIN TestSubmissions ts ON ts.userId = ca2.userId AND ts.courseId = ca2.courseId
          WHERE ts.status = 'pass'
        )
    `);
    const overdueCount = overdueRes.recordset[0]?.overdueCount || 0;

    res.json({
      teamSize,
      mandatoryPending,
      coursesAssigned,
      evaluationsPending,
      teamCompletion,
      overdueCount,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =========================
   TEAM PROGRESS
========================= */
exports.teamProgress = async (req, res) => {
  try {
    const managerId = req.user.id;
    const pool = await getDbPool();

    const result = await pool.request().input("managerId", managerId).query(`
      SELECT
        u.id,
        u.name AS employeeName,
        u.email,
        c.title AS courseTitle,
        COUNT(DISTINCT ch.id) AS totalLessons,
        COUNT(DISTINCT CASE WHEN lp.completed = 1 THEN ch.id END) AS completedLessons,
        CASE 
          WHEN COUNT(DISTINCT ch.id) > 0 AND COUNT(DISTINCT CASE WHEN lp.completed = 1 THEN ch.id END) = COUNT(DISTINCT ch.id) THEN 'Compliant'
          WHEN COUNT(DISTINCT CASE WHEN lp.completed = 1 THEN ch.id END) > COUNT(DISTINCT ch.id) * 0.5 THEN 'Warning'
          ELSE 'Overdue'
        END AS status
      FROM CourseAssignments ca
      JOIN Users u ON u.id = ca.userId
      JOIN Courses c ON c.id = ca.courseId
      JOIN TeamMembers tm ON tm.userId = u.id
      JOIN Teams t ON t.id = tm.teamId
      LEFT JOIN CourseModules m ON m.courseId = c.id
      LEFT JOIN CourseChapters ch ON ch.moduleId = m.id
      LEFT JOIN LessonProgress lp ON lp.chapterId = ch.id AND lp.userId = u.id
      WHERE t.managerId = @managerId
      GROUP BY u.id, u.name, u.email, c.id, c.title
      ORDER BY u.name, c.title
    `);

    const teamProgress = result.recordset.map((row) => ({
      id: row.id,
      employeeName: row.employeeName,
      email: row.email,
      courseTitle: row.courseTitle,
      progress:
        row.totalLessons > 0
          ? Math.round((row.completedLessons / row.totalLessons) * 100)
          : 0,
      status: row.status,
    }));

    res.json(teamProgress);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =========================
   PENDING EVALUATIONS
========================= */
exports.pendingEvaluations = async (req, res) => {
  try {
    const managerId = req.user.id;
    const pool = await getDbPool();

    const result = await pool.request().input("managerId", managerId).query(`
      SELECT
        u.name AS employeeName,
        c.title AS courseTitle
      FROM TestSubmissions ts
      JOIN Users u ON u.id = ts.userId
      JOIN Courses c ON c.id = ts.courseId
      JOIN TeamMembers tm ON tm.userId = u.id
      JOIN Teams t ON t.id = tm.teamId
      WHERE t.managerId = @managerId AND ts.status = 'pending'
      ORDER BY ts.submittedAt DESC
    `);

    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =========================
   RECENT ACTIVITY
========================= */
exports.recentActivity = async (req, res) => {
  try {
    const managerId = req.user.id;
    const pool = await getDbPool();

    // Get recent course completions
    const completionsRes = await pool.request().input("managerId", managerId)
      .query(`
      SELECT TOP 10
        ts.evaluatedAt AS timestamp,
        u.name,
        c.title,
        'success' AS type,
        'completed' AS action
      FROM TestSubmissions ts
      JOIN Users u ON u.id = ts.userId
      JOIN Courses c ON c.id = ts.courseId
      JOIN TeamMembers tm ON tm.userId = u.id
      JOIN Teams t ON t.id = tm.teamId
      WHERE t.managerId = @managerId AND ts.status = 'pass'
      ORDER BY ts.evaluatedAt DESC
    `);

    // Get recent failures
    const failuresRes = await pool.request().input("managerId", managerId)
      .query(`
      SELECT TOP 5
        ts.evaluatedAt AS timestamp,
        u.name,
        c.title,
        'warning' AS type,
        'failed' AS action
      FROM TestSubmissions ts
      JOIN Users u ON u.id = ts.userId
      JOIN Courses c ON c.id = ts.courseId
      JOIN TeamMembers tm ON tm.userId = u.id
      JOIN Teams t ON t.id = tm.teamId
      WHERE t.managerId = @managerId AND ts.status = 'fail'
      ORDER BY ts.evaluatedAt DESC
    `);

    // Get recent assignments
    const assignmentsRes = await pool.request().input("managerId", managerId)
      .query(`
      SELECT TOP 5
        ca.createdAt AS timestamp,
        u.name,
        c.title,
        'info' AS type,
        'assigned' AS action
      FROM CourseAssignments ca
      JOIN Users u ON u.id = ca.userId
      JOIN Courses c ON c.id = ca.courseId
      JOIN TeamMembers tm ON tm.userId = u.id
      JOIN Teams t ON t.id = tm.teamId
      WHERE t.managerId = @managerId
      ORDER BY ca.createdAt DESC
    `);

    // Combine and sort by timestamp
    const activities = [
      ...completionsRes.recordset.map((r) => ({
        time: formatTime(r.timestamp),
        text: `${r.name} completed ${r.title}`,
        type: r.type,
      })),
      ...failuresRes.recordset.map((r) => ({
        time: formatTime(r.timestamp),
        text: `${r.name} failed ${r.title} (Attempt)`,
        type: r.type,
      })),
      ...assignmentsRes.recordset.map((r) => ({
        time: formatTime(r.timestamp),
        text: `System assigned ${r.title} to ${r.name}`,
        type: r.type,
      })),
    ]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 10);

    res.json(activities);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =========================
   TEAM QUIZ SUBMISSIONS
========================= */
exports.teamQuizSubmissions = async (req, res) => {
  try {
    const managerId = req.user.id;
    const pool = await getDbPool();

    const result = await pool.request().input("managerId", managerId).query(`
      SELECT
        qs.id as submissionId,
        qs.quizId,
        q.title as quizTitle,
        c.title as courseName,
        q.passingScore,
        qs.userId,
        u.name,
        CASE WHEN CHARINDEX(' ', u.name) > 0 
          THEN SUBSTRING(u.name, 1, CHARINDEX(' ', u.name) - 1)
          ELSE u.name
        END as firstName,
        CASE WHEN CHARINDEX(' ', u.name) > 0 
          THEN SUBSTRING(u.name, CHARINDEX(' ', u.name) + 1, LEN(u.name))
          ELSE ''
        END as lastName,
        u.email,
        qs.score,
        qs.passed,
        qs.totalQuestions,
        qs.correctAnswers,
        qs.timeTaken,
        qs.submittedAt,
        qs.attemptNumber
      FROM QuizSubmissions qs
      INNER JOIN Quizzes q ON qs.quizId = q.id
      INNER JOIN Courses c ON q.courseId = c.id
      INNER JOIN Users u ON qs.userId = u.id
      INNER JOIN TeamMembers tm ON tm.userId = u.id
      INNER JOIN Teams t ON t.id = tm.teamId
      WHERE t.managerId = @managerId
      ORDER BY c.id, qs.submittedAt DESC
    `);

    res.json({ submissions: result.recordset });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =========================
   MY TEAM
========================= */
exports.myTeam = async (req, res) => {
  try {
    const managerId = req.user.id;
    const pool = await getDbPool();

    const result = await pool.request().input("managerId", managerId).query(`
      SELECT DISTINCT
        u.id,
        u.name AS name,
        u.role
      FROM Users u
      JOIN TeamMembers tm ON tm.userId = u.id
      JOIN Teams t ON t.id = tm.teamId
      WHERE t.managerId = @managerId AND u.role = 'employee'
      ORDER BY u.name
    `);

    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =========================
   HELPER FUNCTIONS
========================= */
function formatTime(date) {
  if (!date) return "Unknown";
  const now = new Date();
  const then = new Date(date);
  const diff = now - then;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  // Format as dd/mm/yyyy hh:mm
  const day = String(then.getDate()).padStart(2, "0");
  const month = String(then.getMonth() + 1).padStart(2, "0");
  const year = then.getFullYear();
  const hours12 = String(then.getHours()).padStart(2, "0");
  const mins = String(then.getMinutes()).padStart(2, "0");

  return `${day}/${month}/${year} ${hours12}:${mins}`;
}
