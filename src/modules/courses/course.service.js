const { getDbPool, sql } = require("../../config/db");
const { parseDocx } = require("./docx.parser");

/**
 * Create course with DOCX parsing
 */
const createCourseWithDocx = async ({
  title,
  category,
  duration,
  description,
  createdBy,
  docxBuffer,
}) => {
  const pool = await getDbPool();

  // 1. Insert course
  const courseResult = await pool
    .request()
    .input("title", title)
    .input("category", category)
    .input("duration", duration)
    .input("description", description)
    .input("createdBy", createdBy).query(`
      INSERT INTO Courses (title, category, duration, description, createdBy)
      OUTPUT INSERTED.id
      VALUES (@title, @category, @duration, @description, @createdBy)
    `);

  const courseId = courseResult.recordset[0].id;

  // 2. Parse DOCX
  const modules = await parseDocx(docxBuffer);

  // 3. Insert modules, chapters, content
  for (let m = 0; m < modules.length; m++) {
    const moduleResult = await pool
      .request()
      .input("courseId", courseId)
      .input("title", modules[m].title)
      .input("order", m + 1).query(`
        INSERT INTO CourseModules (courseId, title, moduleOrder)
        OUTPUT INSERTED.id
        VALUES (@courseId, @title, @order)
      `);

    const moduleId = moduleResult.recordset[0].id;

    for (let c = 0; c < modules[m].chapters.length; c++) {
      const chapter = modules[m].chapters[c];

      const chapterResult = await pool
        .request()
        .input("moduleId", moduleId)
        .input("title", chapter.title)
        .input("order", c + 1).query(`
          INSERT INTO CourseChapters (moduleId, title, chapterOrder)
          OUTPUT INSERTED.id
          VALUES (@moduleId, @title, @order)
        `);

      const chapterId = chapterResult.recordset[0].id;

      await pool
        .request()
        .input("chapterId", chapterId)
        .input("content", chapter.content).query(`
          INSERT INTO ChapterContents (chapterId, content)
          VALUES (@chapterId, @content)
        `);
    }
  }

  return { courseId };
};

/**
 * Employee: fetch assigned courses
 */
const fetchAssignedCoursesForUser = async (userId) => {
  const pool = await getDbPool();

  const result = await pool.request().input("userId", userId).query(`
      SELECT
        c.id,
        c.title,
        c.category,
        c.duration,
        ca.assignmentType
      FROM CourseAssignments ca
      JOIN Courses c ON ca.courseId = c.id
      WHERE ca.userId = @userId
      ORDER BY ca.assignedAt DESC
    `);

  return result.recordset;
};

/**
 * Employee: fetch course content (read-only)
 */
const fetchCourseContentForEmployee = async (courseId, userId) => {
  const pool = await getDbPool();

  // Ensure course is assigned
  const assignmentCheck = await pool
    .request()
    .input("courseId", courseId)
    .input("userId", userId).query(`
      SELECT id
      FROM CourseAssignments
      WHERE courseId = @courseId AND userId = @userId
    `);

  if (assignmentCheck.recordset.length === 0) {
    throw new Error("Course not assigned to this user");
  }

  // Fetch structured content
  const result = await pool.request().input("courseId", courseId).query(`
      SELECT
        m.id AS moduleId,
        m.title AS moduleTitle,
        m.moduleOrder,
        ch.id AS chapterId,
        ch.title AS chapterTitle,
        ch.chapterOrder,
        cc.content
      FROM CourseModules m
      JOIN CourseChapters ch ON ch.moduleId = m.id
      JOIN ChapterContents cc ON cc.chapterId = ch.id
      WHERE m.courseId = @courseId
      ORDER BY m.moduleOrder, ch.chapterOrder
    `);

  const modulesMap = {};

  for (const row of result.recordset) {
    if (!modulesMap[row.moduleId]) {
      modulesMap[row.moduleId] = {
        id: row.moduleId,
        title: row.moduleTitle,
        chapters: [],
      };
    }

    modulesMap[row.moduleId].chapters.push({
      id: row.chapterId,
      title: row.chapterTitle,
      content: row.content,
    });
  }

  return Object.values(modulesMap);
};
/**
 * Assign course to multiple users
 */
const assignCourse = async ({
  courseId,
  userIds,
  assignmentType,
  assignedBy,
}) => {
  const pool = await getDbPool();

  for (const userId of userIds) {
    // Prevent duplicate assignment
    const exists = await pool
      .request()
      .input("courseId", courseId)
      .input("userId", userId).query(`
        SELECT id
        FROM CourseAssignments
        WHERE courseId = @courseId AND userId = @userId
      `);

    if (exists.recordset.length > 0) continue;

    await pool
      .request()
      .input("courseId", courseId)
      .input("userId", userId)
      .input("assignedBy", assignedBy)
      .input("assignmentType", assignmentType).query(`
        INSERT INTO CourseAssignments
          (courseId, userId, assignedBy, assignmentType, assignedAt, dueDate)
        VALUES
          (@courseId, @userId, @assignedBy, @assignmentType, GETDATE(), DATEADD(day, 7, GETDATE()))
      `);
  }
};

/**
 * Fetch assigned user IDs for a course
 */
const fetchAssignedUserIdsForCourse = async (courseId) => {
  const pool = await getDbPool();

  const result = await pool.request().input("courseId", courseId).query(`
    SELECT userId FROM CourseAssignments WHERE courseId = @courseId
  `);

  return result.recordset.map((r) => r.userId);
};

/**
 * Fetch all courses (catalog view)
 */
const fetchCourseCatalog = async () => {
  const pool = await getDbPool();

  const result = await pool.query(`
    SELECT
      c.id,
      c.title,
      c.category,
      c.duration,
      c.description,
      c.createdAt,
      ISNULL((SELECT COUNT(1) FROM CourseAssignments ca WHERE ca.courseId = c.id), 0) AS enrolled
    FROM Courses c
    ORDER BY c.createdAt DESC
  `);

  return result.recordset;
};

/**
 * Fetch total number of course assignments (enrollments)
 */
const fetchTotalAssignmentsCount = async () => {
  const pool = await getDbPool();
  const result = await pool.query(
    `SELECT COUNT(1) AS total FROM CourseAssignments`
  );
  return result.recordset[0]?.total || 0;
};

module.exports = {
  createCourseWithDocx,
  fetchAssignedCoursesForUser,
  fetchCourseContentForEmployee,
  assignCourse,
  fetchCourseCatalog,
  fetchAssignedUserIdsForCourse,
  fetchTotalAssignmentsCount,
  // Admin: fetch structured content without assignment check
  fetchCourseContentForAdmin: async (courseId) => {
    const pool = await getDbPool();

    const result = await pool.request().input("courseId", courseId).query(`
        SELECT
          m.id AS moduleId,
          m.title AS moduleTitle,
          m.moduleOrder,
          ch.id AS chapterId,
          ch.title AS chapterTitle,
          ch.chapterOrder,
          cc.content
        FROM CourseModules m
        JOIN CourseChapters ch ON ch.moduleId = m.id
        JOIN ChapterContents cc ON cc.chapterId = ch.id
        WHERE m.courseId = @courseId
        ORDER BY m.moduleOrder, ch.chapterOrder
      `);

    const modulesMap = {};

    for (const row of result.recordset) {
      if (!modulesMap[row.moduleId]) {
        modulesMap[row.moduleId] = {
          id: row.moduleId,
          title: row.moduleTitle,
          chapters: [],
        };
      }

      modulesMap[row.moduleId].chapters.push({
        id: row.chapterId,
        title: row.chapterTitle,
        content: row.content,
      });
    }

    return Object.values(modulesMap);
  },
  // Admin: persist full structured content (modules -> chapters -> contents)
  saveCourseContentForAdmin: async (courseId, modules) => {
    const pool = await getDbPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      // Delete existing contents for the course (contents -> chapters -> modules)
      let req = new sql.Request(transaction);
      await req.input("courseId", courseId).query(`
        DELETE cc
        FROM ChapterContents cc
        JOIN CourseChapters ch ON cc.chapterId = ch.id
        JOIN CourseModules m ON ch.moduleId = m.id
        WHERE m.courseId = @courseId
      `);

      req = new sql.Request(transaction);
      await req.input("courseId", courseId).query(`
        DELETE ch
        FROM CourseChapters ch
        JOIN CourseModules m ON ch.moduleId = m.id
        WHERE m.courseId = @courseId
      `);

      req = new sql.Request(transaction);
      await req.input("courseId", courseId).query(`
        DELETE FROM CourseModules WHERE courseId = @courseId
      `);

      // Insert new modules, chapters, and contents
      for (let m = 0; m < modules.length; m++) {
        const mod = modules[m] || {};
        const title = mod.title || `Module ${m + 1}`;

        req = new sql.Request(transaction);
        const modRes = await req
          .input("courseId", courseId)
          .input("title", title)
          .input("order", m + 1).query(`
            INSERT INTO CourseModules (courseId, title, moduleOrder)
            OUTPUT INSERTED.id
            VALUES (@courseId, @title, @order)
        `);

        const moduleId = modRes.recordset[0].id;

        const chapters = Array.isArray(mod.chapters) ? mod.chapters : [];
        for (let c = 0; c < chapters.length; c++) {
          const ch = chapters[c] || {};
          const chTitle = ch.title || `Chapter ${c + 1}`;

          req = new sql.Request(transaction);
          const chRes = await req
            .input("moduleId", moduleId)
            .input("title", chTitle)
            .input("order", c + 1).query(`
              INSERT INTO CourseChapters (moduleId, title, chapterOrder)
              OUTPUT INSERTED.id
              VALUES (@moduleId, @title, @order)
          `);

          const chapterId = chRes.recordset[0].id;

          req = new sql.Request(transaction);
          await req
            .input("chapterId", chapterId)
            .input("content", ch.content || "").query(`
              INSERT INTO ChapterContents (chapterId, content)
              VALUES (@chapterId, @content)
          `);
        }
      }

      await transaction.commit();
      return true;
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },
};
