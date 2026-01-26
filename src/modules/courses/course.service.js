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

  // Fetch structured content with media
  const result = await pool.request().input("courseId", courseId).query(`
      SELECT
        m.id AS moduleId,
        m.title AS moduleTitle,
        m.moduleOrder,
        ch.id AS chapterId,
        ch.title AS chapterTitle,
        ch.chapterOrder,
        cc.content,
        cm.id AS mediaId,
        cm.mediaUrl,
        cm.fileName,
        cm.mediaType,
        cm.mimeType,
        cm.fileSize,
        cm.blobName
      FROM CourseModules m
      JOIN CourseChapters ch ON ch.moduleId = m.id
      JOIN ChapterContents cc ON cc.chapterId = ch.id
      LEFT JOIN ChapterMedia cm ON cm.chapterId = ch.id
      WHERE m.courseId = @courseId
      ORDER BY m.moduleOrder, ch.chapterOrder, cm.id
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

    const existingChapter = modulesMap[row.moduleId].chapters.find(
      (ch) => ch.id === row.chapterId,
    );

    if (!existingChapter) {
      modulesMap[row.moduleId].chapters.push({
        id: row.chapterId,
        title: row.chapterTitle,
        content: row.content,
        media: [],
      });
    }

    // Add media if it exists
    if (row.mediaId) {
      const chapter = modulesMap[row.moduleId].chapters.find(
        (ch) => ch.id === row.chapterId,
      );
      if (chapter && !chapter.media.find((m) => m.id === row.mediaId)) {
        chapter.media.push({
          id: row.mediaId,
          url: row.mediaUrl,
          fileName: row.fileName,
          mediaType: row.mediaType,
          mimeType: row.mimeType,
          size: row.fileSize,
          blobName: row.blobName,
        });
      }
    }
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
 * Get enrolled users for a course with their details
 */
const fetchEnrolledUsersForCourse = async (courseId) => {
  const pool = await getDbPool();

  const result = await pool.request().input("courseId", courseId).query(`
    SELECT 
      u.id,
      u.name,
      u.email,
      u.role,
      ca.assignmentType,
      ca.assignedAt,
      ca.id AS assignmentId
    FROM CourseAssignments ca
    JOIN Users u ON ca.userId = u.id
    WHERE ca.courseId = @courseId
    ORDER BY ca.assignedAt DESC
  `);

  return result.recordset;
};

/**
 * Unassign a user from a course
 */
const unassignUserFromCourse = async (courseId, userId) => {
  const pool = await getDbPool();

  const result = await pool
    .request()
    .input("courseId", courseId)
    .input("userId", userId).query(`
      DELETE FROM CourseAssignments 
      WHERE courseId = @courseId AND userId = @userId
    `);

  if (result.rowsAffected[0] === 0) {
    throw new Error("Assignment not found");
  }

  return true;
};

/**
 * Get completed users for a course
 */
const fetchCompletedUsersForCourse = async (courseId) => {
  const pool = await getDbPool();

  const result = await pool.request().input("courseId", courseId).query(`
    SELECT DISTINCT
      u.id,
      u.name,
      u.email,
      u.role,
      ca.assignedAt,
      COUNT(DISTINCT ch.id) AS totalLessons,
      COUNT(DISTINCT CASE WHEN lp.completed = 1 THEN ch.id END) AS completedLessons
    FROM CourseAssignments ca
    JOIN Users u ON ca.userId = u.id
    JOIN CourseModules m ON m.courseId = ca.courseId
    JOIN CourseChapters ch ON ch.moduleId = m.id
    LEFT JOIN LessonProgress lp 
      ON lp.chapterId = ch.id AND lp.userId = ca.userId AND lp.completed = 1
    WHERE ca.courseId = @courseId
    GROUP BY u.id, u.name, u.email, u.role, ca.assignedAt
    HAVING COUNT(DISTINCT ch.id) > 0 AND COUNT(DISTINCT ch.id) = COUNT(DISTINCT CASE WHEN lp.completed = 1 THEN ch.id END)
    ORDER BY ca.assignedAt DESC
  `);

  return result.recordset;
};

/**
 * Delete a course and all its related data
 */
const deleteCourseFully = async (courseId) => {
  const pool = await getDbPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    // Delete lesson progress for all users in this course
    let req = new sql.Request(transaction);
    await req.input("courseId", courseId).query(`
      DELETE lp
      FROM LessonProgress lp
      JOIN CourseChapters ch ON lp.chapterId = ch.id
      JOIN CourseModules m ON ch.moduleId = m.id
      WHERE m.courseId = @courseId
    `);

    // Delete chapter contents
    req = new sql.Request(transaction);
    await req.input("courseId", courseId).query(`
      DELETE cc
      FROM ChapterContents cc
      JOIN CourseChapters ch ON cc.chapterId = ch.id
      JOIN CourseModules m ON ch.moduleId = m.id
      WHERE m.courseId = @courseId
    `);

    // Delete chapters
    req = new sql.Request(transaction);
    await req.input("courseId", courseId).query(`
      DELETE ch
      FROM CourseChapters ch
      JOIN CourseModules m ON ch.moduleId = m.id
      WHERE m.courseId = @courseId
    `);

    // Delete modules
    req = new sql.Request(transaction);
    await req.input("courseId", courseId).query(`
      DELETE FROM CourseModules WHERE courseId = @courseId
    `);

    // Delete course assignments
    req = new sql.Request(transaction);
    await req.input("courseId", courseId).query(`
      DELETE FROM CourseAssignments WHERE courseId = @courseId
    `);

    // Delete the course
    req = new sql.Request(transaction);
    await req.input("courseId", courseId).query(`
      DELETE FROM Courses WHERE id = @courseId
    `);

    await transaction.commit();
    return true;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
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
      c.createdBy,
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
    `SELECT COUNT(1) AS total FROM CourseAssignments`,
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
  fetchEnrolledUsersForCourse,
  unassignUserFromCourse,
  fetchCompletedUsersForCourse,
  deleteCourseFully,
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
          cc.content,
          cm.id AS mediaId,
          cm.mediaUrl,
          cm.fileName,
          cm.mediaType,
          cm.mimeType,
          cm.fileSize,
          cm.blobName
        FROM CourseModules m
        JOIN CourseChapters ch ON ch.moduleId = m.id
        JOIN ChapterContents cc ON cc.chapterId = ch.id
        LEFT JOIN ChapterMedia cm ON cm.chapterId = ch.id
        WHERE m.courseId = @courseId
        ORDER BY m.moduleOrder, ch.chapterOrder, cm.id
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

      const existingChapter = modulesMap[row.moduleId].chapters.find(
        (ch) => ch.id === row.chapterId,
      );

      if (!existingChapter) {
        modulesMap[row.moduleId].chapters.push({
          id: row.chapterId,
          title: row.chapterTitle,
          content: row.content,
          media: [],
        });
      }

      // Add media if it exists
      if (row.mediaId) {
        const chapter = modulesMap[row.moduleId].chapters.find(
          (ch) => ch.id === row.chapterId,
        );
        if (chapter && !chapter.media.find((m) => m.id === row.mediaId)) {
          chapter.media.push({
            id: row.mediaId,
            url: row.mediaUrl,
            fileName: row.fileName,
            mediaType: row.mediaType,
            mimeType: row.mimeType,
            size: row.fileSize,
            blobName: row.blobName,
          });
        }
      }
    }

    return Object.values(modulesMap);
  },
  // Admin: persist full structured content (modules -> chapters -> contents)
  saveCourseContentForAdmin: async (courseId, modules) => {
    const pool = await getDbPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      // Delete existing contents for the course (must respect foreign keys)
      // Order: LessonProgress -> ChapterContents -> CourseChapters -> CourseModules

      // 1. Delete LessonProgress records first (they reference chapters)
      let req = new sql.Request(transaction);
      await req.input("courseId", courseId).query(`
        DELETE lp
        FROM LessonProgress lp
        JOIN CourseChapters ch ON lp.chapterId = ch.id
        JOIN CourseModules m ON ch.moduleId = m.id
        WHERE m.courseId = @courseId
      `);

      // 2. Delete ChapterContents
      req = new sql.Request(transaction);
      await req.input("courseId", courseId).query(`
        DELETE cc
        FROM ChapterContents cc
        JOIN CourseChapters ch ON cc.chapterId = ch.id
        JOIN CourseModules m ON ch.moduleId = m.id
        WHERE m.courseId = @courseId
      `);

      // 3. Delete CourseChapters
      req = new sql.Request(transaction);
      await req.input("courseId", courseId).query(`
        DELETE ch
        FROM CourseChapters ch
        JOIN CourseModules m ON ch.moduleId = m.id
        WHERE m.courseId = @courseId
      `);

      // 4. Delete CourseModules
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

          // Insert media for this chapter
          if (Array.isArray(ch.media) && ch.media.length > 0) {
            for (const media of ch.media) {
              req = new sql.Request(transaction);
              await req
                .input("chapterId", chapterId)
                .input("mediaUrl", media.url || "")
                .input("fileName", media.fileName || "")
                .input("mediaType", media.mediaType || "image")
                .input("mimeType", media.mimeType || "")
                .input("fileSize", media.size || 0)
                .input("blobName", media.blobName || "").query(`
                  INSERT INTO ChapterMedia 
                  (chapterId, mediaUrl, fileName, mediaType, mimeType, fileSize, blobName)
                  VALUES (@chapterId, @mediaUrl, @fileName, @mediaType, @mimeType, @fileSize, @blobName)
              `);
            }
          }
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
