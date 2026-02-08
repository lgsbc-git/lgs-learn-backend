const { getDbPool, sql } = require("../../config/db");

/**
 * ============ INSTRUCTOR: QUIZ CRUD ============
 */

/**
 * Create or replace quiz for a course
 * @param {Object} quizData - Quiz details with questions
 * @returns {Promise<{id: number, success: boolean}>}
 */
const createOrUpdateQuiz = async ({
  courseId,
  title,
  description,
  passingScore = 60,
  timeLimit = null,
  showResults = true,
  showCorrectAnswers = true,
  questions = [], // [{question, explanation, options: [{text, isCorrect},...]}]
  createdBy,
}) => {
  const pool = await getDbPool();
  const transaction = pool.transaction();

  try {
    await transaction.begin();

    // Check if quiz already exists for this course
    let req = transaction.request();
    const existing = await req
      .input("courseId", sql.Int, courseId)
      .query(
        `SELECT id FROM Quizzes WHERE courseId = @courseId AND isActive = 1`,
      );

    let quizId;

    if (existing.recordset.length > 0) {
      // Update existing quiz
      quizId = existing.recordset[0].id;
      req = transaction
        .request()
        .input("quizId", sql.Int, quizId)
        .input("title", sql.NVarChar(255), title)
        .input("description", sql.NVarChar(sql.MAX), description || null)
        .input("passingScore", sql.Int, passingScore)
        .input("timeLimit", sql.Int, timeLimit)
        .input("showResults", sql.Bit, showResults ? 1 : 0)
        .input("showCorrectAnswers", sql.Bit, showCorrectAnswers ? 1 : 0);

      await req.query(`
        UPDATE Quizzes
        SET title = @title,
            description = @description,
            passingScore = @passingScore,
            timeLimit = @timeLimit,
            showResults = @showResults,
            showCorrectAnswers = @showCorrectAnswers,
            updatedAt = GETUTCDATE()
        WHERE id = @quizId
      `);

      // Delete existing questions
      req = transaction.request().input("quizId", sql.Int, quizId);

      await req.query(`DELETE FROM QuizQuestions WHERE quizId = @quizId`);
    } else {
      // Create new quiz
      req = transaction
        .request()
        .input("courseId", sql.Int, courseId)
        .input("title", sql.NVarChar(255), title)
        .input("description", sql.NVarChar(sql.MAX), description || null)
        .input("passingScore", sql.Int, passingScore)
        .input("timeLimit", sql.Int, timeLimit)
        .input("showResults", sql.Bit, showResults ? 1 : 0)
        .input("showCorrectAnswers", sql.Bit, showCorrectAnswers ? 1 : 0)
        .input("createdBy", sql.Int, createdBy);

      const result = await req.query(`
        INSERT INTO Quizzes 
        (courseId, title, description, passingScore, timeLimit, showResults, showCorrectAnswers, createdBy, isActive)
        OUTPUT INSERTED.id
        VALUES (@courseId, @title, @description, @passingScore, @timeLimit, @showResults, @showCorrectAnswers, @createdBy, 1)
      `);
      quizId = result.recordset[0].id;
    }

    // Insert questions and options
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      console.log(`📝 Saving question ${i + 1}: "${q.question}"`);
      req = transaction
        .request()
        .input("quizId", sql.Int, quizId)
        .input("question", sql.NVarChar(sql.MAX), q.question)
        .input("explanation", sql.NVarChar(sql.MAX), q.explanation || null)
        .input("questionOrder", sql.Int, i + 1);

      const qResult = await req.query(`
        INSERT INTO QuizQuestions (quizId, question, explanation, questionOrder)
        OUTPUT INSERTED.id
        VALUES (@quizId, @question, @explanation, @questionOrder)
      `);

      const questionId = qResult.recordset[0].id;

      // Insert options for this question
      for (let j = 0; j < (q.options || []).length; j++) {
        const opt = q.options[j];
        const isCorrectBit = opt.isCorrect ? 1 : 0;
        console.log(
          `  ✓ Option j=${j}: text="${opt.text}", isCorrect=${opt.isCorrect} (converted to bit: ${isCorrectBit})`,
        );
        req = transaction
          .request()
          .input("questionId", sql.Int, questionId)
          .input("optionText", sql.NVarChar(sql.MAX), opt.text)
          .input("isCorrect", sql.Bit, isCorrectBit)
          .input("optionOrder", sql.Int, j + 1);

        await req.query(`
          INSERT INTO QuizOptions (questionId, optionText, isCorrect, optionOrder)
          VALUES (@questionId, @optionText, @isCorrect, @optionOrder)
        `);
      }
    }

    await transaction.commit();
    return { id: quizId, success: true };
  } catch (err) {
    await transaction.rollback();
    throw new Error(`Failed to create/update quiz: ${err.message}`);
  }
};

/**
 * Get quiz by course ID with all questions and options
 */
const getQuizByCourse = async (courseId) => {
  const pool = await getDbPool();
  try {
    console.log(
      "📋 quizService.getQuizByCourse - querying for courseId:",
      courseId,
    );

    // Get quiz
    const req = pool.request().input("courseId", sql.Int, courseId);
    const result = await req.query(`
      SELECT
        q.id,
        q.courseId,
        q.title,
        q.description,
        q.passingScore,
        q.timeLimit,
        q.showResults,
        q.showCorrectAnswers,
        q.createdAt,
        q.updatedAt
      FROM Quizzes q
      WHERE q.courseId = @courseId AND q.isActive = 1
    `);

    console.log("Query result recordset length:", result.recordset.length);

    if (result.recordset.length === 0) {
      console.log(
        "⚠️  No quiz records found in database for courseId:",
        courseId,
      );
      return null;
    }

    const quiz = result.recordset[0];
    console.log("✅ Quiz found:", JSON.stringify(quiz, null, 2));

    // Fetch questions
    const qReq = pool.request().input("quizId", sql.Int, quiz.id);
    const questionsResult = await qReq.query(`
      SELECT 
        id, 
        question, 
        explanation, 
        questionOrder
      FROM QuizQuestions
      WHERE quizId = @quizId
      ORDER BY questionOrder ASC
    `);

    console.log("Questions found:", questionsResult.recordset.length);

    // Fetch options for each question
    const questions = await Promise.all(
      questionsResult.recordset.map(async (q) => {
        const optReq = pool.request().input("questionId", sql.Int, q.id);
        const optionsResult = await optReq.query(`
          SELECT 
            id, 
            optionText, 
            isCorrect, 
            optionOrder
          FROM QuizOptions
          WHERE questionId = @questionId
          ORDER BY optionOrder ASC
        `);

        return {
          id: q.id,
          question: q.question,
          explanation: q.explanation,
          options: optionsResult.recordset.map((opt) => ({
            id: opt.id,
            text: opt.optionText,
            isCorrect: Boolean(opt.isCorrect),
          })),
        };
      }),
    );

    const response = {
      id: quiz.id,
      courseId: quiz.courseId,
      title: quiz.title,
      description: quiz.description,
      passingScore: quiz.passingScore,
      timeLimit: quiz.timeLimit,
      showResults: Boolean(quiz.showResults),
      showCorrectAnswers: Boolean(quiz.showCorrectAnswers),
      createdAt: quiz.createdAt,
      updatedAt: quiz.updatedAt,
      questions,
    };

    console.log(
      "📦 Returning quiz response with",
      questions.length,
      "questions",
    );
    return response;
  } catch (err) {
    console.error("❌ Error in getQuizByCourse:", err.message, err.stack);
    throw new Error(`Failed to fetch quiz: ${err.message}`);
  }
};

/**
 * Soft delete quiz
 */
const deleteQuiz = async (quizId) => {
  const pool = await getDbPool();
  try {
    await pool.request().input("quizId", sql.Int, quizId).query(`
        UPDATE Quizzes 
        SET isActive = 0, updatedAt = GETUTCDATE() 
        WHERE id = @quizId
      `);
  } catch (err) {
    throw new Error(`Failed to delete quiz: ${err.message}`);
  }
};

/**
 * ============ EMPLOYEE: QUIZ TAKING ============
 */

/**
 * Check if employee can attempt quiz (must have completed course 100%)
 */
const canAttemptQuiz = async (courseId, userId) => {
  const pool = await getDbPool();
  try {
    // Get all chapters in course
    const chaptersResult = await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .query(
        `SELECT COUNT(*) as total FROM CourseChapters WHERE courseId = @courseId`,
      );

    const totalChapters = chaptersResult.recordset[0].total;
    if (totalChapters === 0) return false;

    // Get completed chapters
    const completedResult = await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .input("userId", sql.Int, userId).query(`
        SELECT COUNT(DISTINCT cc.id) as completed
        FROM CourseChapters cc
        JOIN LessonCompletion lc ON cc.id = lc.lessonId
        WHERE cc.courseId = @courseId AND lc.userId = @userId AND lc.completedAt IS NOT NULL
      `);

    const completedChapters = completedResult.recordset[0].completed;
    return completedChapters === totalChapters;
  } catch (err) {
    throw new Error(`Failed to check quiz eligibility: ${err.message}`);
  }
};

/**
 * Submit quiz answers and calculate score
 */
const submitQuizAnswers = async (quizId, userId, answers, timeTaken) => {
  console.log(
    `\n🔍 [submitQuizAnswers] Starting submission - quizId: ${quizId}, userId: ${userId}, answers count: ${answers.length}, timeTaken: ${timeTaken}s`,
  );
  const pool = await getDbPool();
  const transaction = pool.transaction();

  try {
    await transaction.begin();
    console.log("✓ Transaction started");
    let request = transaction.request();

    // CHECK: Prevent re-attempts - user can only submit quiz once
    let attemptCheckReq = transaction
      .request()
      .input("quizId", sql.Int, quizId)
      .input("userId", sql.Int, userId);
    const attemptCheck = await attemptCheckReq.query(`
      SELECT id FROM QuizSubmissions 
      WHERE quizId = @quizId AND userId = @userId
    `);

    if (attemptCheck.recordset.length > 0) {
      console.log("❌ Previous attempt found - rejecting submission");
      throw new Error(
        "You have already attempted this quiz. Only one attempt is allowed.",
      );
    }
    console.log("✓ No previous attempts found");

    let correctCount = 0;

    // Get total questions in the quiz FIRST
    let totalQuestionsReq = transaction
      .request()
      .input("quizId", sql.Int, quizId);
    const totalQuestionsResult = await totalQuestionsReq.query(
      `SELECT COUNT(*) as total FROM QuizQuestions WHERE quizId = @quizId`,
    );
    const totalQuestions = totalQuestionsResult.recordset[0].total || 0;
    console.log(`📚 Total questions in quiz: ${totalQuestions}`);

    // Verify each answer and count correct ones
    for (const answer of answers) {
      let ansReq = transaction
        .request()
        .input("optionId", sql.Int, answer.selectedOptionId);
      const optResult = await ansReq.query(
        `SELECT isCorrect FROM QuizOptions WHERE id = @optionId`,
      );

      const isCorrect =
        optResult.recordset[0]?.isCorrect === true ||
        optResult.recordset[0]?.isCorrect === 1;
      console.log(
        `✓ Answer optionId: ${answer.selectedOptionId}, isCorrect: ${isCorrect}`,
      );
      if (isCorrect) {
        correctCount++;
      }
    }

    // Score is calculated as: (correct answers / total questions in quiz) * 100
    // This means unattempted questions count as wrong
    const score =
      totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;
    console.log(
      `📊 Score Calculation: ${correctCount}/${totalQuestions} = ${score}% (attempted: ${answers.length}/${totalQuestions})`,
    );

    // Get quiz passing score
    let quizReq = transaction.request().input("quizId", sql.Int, quizId);
    const quizResult = await quizReq.query(
      `SELECT passingScore FROM Quizzes WHERE id = @quizId`,
    );

    const passingScore = quizResult.recordset[0].passingScore;
    const passed = score >= passingScore ? 1 : 0;
    console.log(
      `🎯 Passing score: ${passingScore}%, Student passed: ${passed === 1 ? "YES" : "NO"}`,
    );

    // Create submission record
    let subReq = transaction
      .request()
      .input("quizId", sql.Int, quizId)
      .input("userId", sql.Int, userId)
      .input("score", sql.Decimal(5, 2), score)
      .input("passed", sql.Bit, passed)
      .input("totalQuestions", sql.Int, totalQuestions)
      .input("correctAnswers", sql.Int, correctCount)
      .input("timeTaken", sql.Int, timeTaken);
    const submissionResult = await subReq.query(`
        INSERT INTO QuizSubmissions (quizId, userId, score, passed, totalQuestions, correctAnswers, timeTaken)
        OUTPUT INSERTED.id
        VALUES (@quizId, @userId, @score, @passed, @totalQuestions, @correctAnswers, @timeTaken)
      `);

    const submissionId = submissionResult.recordset[0].id;
    console.log(`✅ QuizSubmission created - submissionId: ${submissionId}`);

    // Record individual answers with question and option details
    for (const answer of answers) {
      let ansReq2 = transaction
        .request()
        .input("optionId", sql.Int, answer.selectedOptionId)
        .input("questionId", sql.Int, answer.questionId);

      // Get option and question details
      const optResult = await ansReq2.query(`
        SELECT qo.id, qo.optionText, qo.isCorrect, qq.question
        FROM QuizOptions qo
        JOIN QuizQuestions qq ON qo.questionId = qq.id
        WHERE qo.id = @optionId AND qq.id = @questionId
      `);

      const option = optResult.recordset[0];
      if (!option) {
        throw new Error(
          `Invalid question or option: ${answer.questionId}, ${answer.selectedOptionId}`,
        );
      }

      const isCorrect =
        option.isCorrect === true || option.isCorrect === 1 ? 1 : 0;

      let recReq = transaction
        .request()
        .input("submissionId", sql.Int, submissionId)
        .input("questionId", sql.Int, answer.questionId)
        .input("selectedOptionId", sql.Int, answer.selectedOptionId)
        .input("isCorrect", sql.Bit, isCorrect)
        .input("questionText", sql.NVarChar(sql.MAX), option.question)
        .input("selectedOptionText", sql.NVarChar(sql.MAX), option.optionText);
      await recReq.query(`
        INSERT INTO QuizAnswers (submissionId, questionId, selectedOptionId, isCorrect, questionText, selectedOptionText)
        VALUES (@submissionId, @questionId, @selectedOptionId, @isCorrect, @questionText, @selectedOptionText)
      `);
    }

    await transaction.commit();
    console.log(`✅ Transaction committed successfully\n`);
    return {
      submissionId,
      score,
      passed: passed === 1,
      correctAnswers: correctCount,
      totalQuestions,
      timeTaken,
    };
  } catch (err) {
    await transaction.rollback();
    console.log(`❌ Transaction rolled back - Error: ${err.message}\n`);
    throw new Error(`Failed to submit quiz: ${err.message}`);
  }
};

/**
 * Get quiz results for a submission
 */
const getQuizResults = async (submissionId) => {
  const pool = await getDbPool();
  try {
    const submissionResult = await pool
      .request()
      .input("submissionId", sql.Int, submissionId).query(`
        SELECT
          qs.id,
          qs.quizId,
          qs.userId,
          qs.score,
          qs.passed,
          qs.totalQuestions,
          qs.correctAnswers,
          qs.timeTaken,
          qs.submittedAt
        FROM QuizSubmissions qs
        WHERE qs.id = @submissionId
      `);

    if (submissionResult.recordset.length === 0) {
      throw new Error("Submission not found");
    }

    const submission = submissionResult.recordset[0];

    // Fetch answers with question and option details
    const answersResult = await pool
      .request()
      .input("submissionId", sql.Int, submissionId).query(`
        SELECT
          qa.id,
          qa.questionId,
          qq.question,
          qa.selectedOptionId,
          qo.optionText as selectedText,
          qa.isCorrect,
          (SELECT optionText FROM QuizOptions WHERE questionId = qq.id AND isCorrect = 1) as correctText
        FROM QuizAnswers qa
        JOIN QuizQuestions qq ON qa.questionId = qq.id
        LEFT JOIN QuizOptions qo ON qa.selectedOptionId = qo.id
        WHERE qa.submissionId = @submissionId
        ORDER BY qq.questionOrder ASC
      `);

    return {
      ...submission,
      answers: answersResult.recordset,
    };
  } catch (err) {
    throw new Error(`Failed to fetch results: ${err.message}`);
  }
};

/**
 * Get user's quiz attempt history for a course
 */
const getUserQuizHistory = async (courseId, userId) => {
  const pool = await getDbPool();
  try {
    const result = await pool
      .request()
      .input("courseId", sql.Int, courseId)
      .input("userId", sql.Int, userId).query(`
        SELECT
          qs.id,
          qs.quizId,
          qs.score,
          qs.passed,
          qs.submittedAt,
          qs.correctAnswers,
          qs.totalQuestions,
          qs.attemptNumber
        FROM QuizSubmissions qs
        JOIN Quizzes q ON qs.quizId = q.id
        WHERE q.courseId = @courseId AND qs.userId = @userId
        ORDER BY qs.submittedAt DESC
      `);

    return result.recordset;
  } catch (err) {
    throw new Error(`Failed to fetch submission history: ${err.message}`);
  }
};

/**
 * Get all quiz submissions for a specific course
 * Used by instructors/admins to review submissions
 */
const getCourseQuizSubmissions = async (courseId) => {
  const pool = await getDbPool();

  try {
    const req = pool.request().input("courseId", sql.Int, courseId);

    const result = await req.query(`
      SELECT 
        qs.id as submissionId,
        qs.quizId,
        q.title as quizTitle,
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
      INNER JOIN Users u ON qs.userId = u.id
      WHERE q.courseId = @courseId AND q.isActive = 1
      ORDER BY qs.submittedAt DESC
    `);

    return result.recordset || [];
  } catch (err) {
    console.error("Error getting course quiz submissions:", err);
    throw new Error("Failed to fetch quiz submissions");
  }
};

/**
 * Get all quiz submissions (admin only)
 */
const getAllQuizSubmissions = async () => {
  const pool = await getDbPool();

  try {
    const req = pool.request();

    const result = await req.query(`
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
      WHERE q.isActive = 1
      ORDER BY c.id, qs.submittedAt DESC
    `);

    return result.recordset || [];
  } catch (err) {
    console.error("Error getting all quiz submissions:", err);
    throw new Error("Failed to fetch quiz submissions");
  }
};

/**
 * Get detailed submission with all answers and evaluation
 * MANAGER/INSTRUCTOR/ADMIN: View student responses
 */
const getSubmissionDetails = async (submissionId) => {
  const pool = await getDbPool();

  try {
    const req = pool.request().input("submissionId", sql.Int, submissionId);

    // Get submission header info
    const headerResult = await req.query(`
      SELECT 
        qs.id as submissionId,
        qs.quizId,
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
        q.title as quizTitle,
        c.id as courseId,
        c.title as courseName,
        q.passingScore,
        qs.score,
        qs.passed,
        qs.totalQuestions,
        qs.correctAnswers,
        qs.timeTaken,
        qs.submittedAt,
        CASE WHEN qs.passed = 1 THEN 'Pass' ELSE 'Fail' END as evaluationStatus
      FROM QuizSubmissions qs
      INNER JOIN Users u ON qs.userId = u.id
      INNER JOIN Quizzes q ON qs.quizId = q.id
      INNER JOIN Courses c ON q.courseId = c.id
      WHERE qs.id = @submissionId
    `);

    if (headerResult.recordset.length === 0) {
      throw new Error("Submission not found");
    }

    const header = headerResult.recordset[0];

    // Get all answers with question and option details
    const answersResult = await req.query(`
      SELECT 
        qa.id,
        qa.questionId,
        qa.questionText,
        qa.selectedOptionId,
        qa.selectedOptionText,
        qa.isCorrect,
        qo.optionText as correctOptionText
      FROM QuizAnswers qa
      LEFT JOIN QuizQuestions qq ON qa.questionId = qq.id
      LEFT JOIN QuizOptions qo ON qq.id = qo.questionId AND qo.isCorrect = 1
      WHERE qa.submissionId = @submissionId
      ORDER BY qa.id
    `);

    return {
      ...header,
      answers: answersResult.recordset || [],
    };
  } catch (err) {
    console.error("Error getting submission details:", err);
    throw new Error("Failed to fetch submission details");
  }
};

/**
 * Check if employee can attempt quiz (not attempted before)
 */
const checkQuizAttempt = async (quizId, userId) => {
  const pool = await getDbPool();

  try {
    const req = pool
      .request()
      .input("quizId", sql.Int, quizId)
      .input("userId", sql.Int, userId);

    const result = await req.query(`
      SELECT COUNT(*) as attemptCount FROM QuizSubmissions
      WHERE quizId = @quizId AND userId = @userId
    `);

    const attemptCount = result.recordset[0].attemptCount;
    return {
      canAttempt: attemptCount === 0,
      attemptCount: attemptCount,
      message:
        attemptCount > 0
          ? "You have already attempted this quiz"
          : "You can attempt this quiz",
    };
  } catch (err) {
    console.error("Error checking quiz attempt:", err);
    throw new Error("Failed to check quiz attempt");
  }
};

/**
 * ============ STAFF APPROVAL WORKFLOW ============
 */

/**
 * Approve a quiz submission for certification
 * STAFF: Mark submission as approved, allowing certificate to be issued
 */
const approveSubmission = async (submissionId, staffUserId) => {
  const pool = await getDbPool();

  try {
    const req = pool
      .request()
      .input("submissionId", sql.Int, submissionId)
      .input("staffUserId", sql.Int, staffUserId)
      .input("approvedAt", sql.DateTime2, new Date());

    const result = await req.query(`
      UPDATE QuizSubmissions
      SET approvalStatus = 'approved',
          approvedBy = @staffUserId,
          approvedAt = @approvedAt
      WHERE id = @submissionId
      
      SELECT @@ROWCOUNT as rowsAffected
    `);

    if (result.recordset[0].rowsAffected === 0) {
      throw new Error("Submission not found");
    }

    return {
      success: true,
      message: "Submission approved successfully",
      submissionId,
    };
  } catch (err) {
    console.error("Error approving submission:", err);
    throw new Error(`Failed to approve submission: ${err.message}`);
  }
};

/**
 * Reject a quiz submission and delete the submission record
 * Employee must retake the quiz
 */
const rejectSubmission = async (submissionId, staffUserId, rejectionReason) => {
  const pool = await getDbPool();
  const transaction = pool.transaction();

  try {
    await transaction.begin();

    // Get submission details and course info
    let getReq = transaction
      .request()
      .input("submissionId", sql.Int, submissionId);
    const submissionResult = await getReq.query(`
      SELECT qs.quizId, qs.userId, q.courseId 
      FROM QuizSubmissions qs
      JOIN Quizzes q ON q.id = qs.quizId
      WHERE qs.id = @submissionId
    `);

    if (submissionResult.recordset.length === 0) {
      await transaction.rollback();
      throw new Error("Submission not found");
    }

    const { quizId, userId, courseId } = submissionResult.recordset[0];

    // Step 1: Delete associated quiz answers
    let deleteAnswersReq = transaction
      .request()
      .input("submissionId", sql.Int, submissionId);
    await deleteAnswersReq.query(`
      DELETE FROM QuizAnswers WHERE submissionId = @submissionId
    `);

    // Step 2: Delete the submission (rejection = removal)
    let deleteReq = transaction
      .request()
      .input("submissionId", sql.Int, submissionId);
    await deleteReq.query(`
      DELETE FROM QuizSubmissions WHERE id = @submissionId
    `);

    // Step 3: RESET COURSE PROGRESS - Delete all lesson progress for this employee and course
    // This resets the employee's course progress to 0%
    let resetProgressReq = transaction
      .request()
      .input("userId", sql.Int, userId)
      .input("courseId", sql.Int, courseId);

    await resetProgressReq.query(`
      DELETE FROM LessonProgress 
      WHERE userId = @userId 
        AND chapterId IN (
          SELECT ch.id 
          FROM CourseChapters ch
          JOIN CourseModules m ON m.id = ch.moduleId
          WHERE m.courseId = @courseId
        )
    `);

    // Step 4: Log the rejection for audit trail
    let logReq = transaction
      .request()
      .input("submissionId", sql.Int, submissionId)
      .input("staffUserId", sql.Int, staffUserId)
      .input("userId", sql.Int, userId)
      .input("courseId", sql.Int, courseId)
      .input("quizId", sql.Int, quizId)
      .input("rejectionReason", sql.NVarChar(sql.MAX), rejectionReason)
      .input("rejectedAt", sql.DateTime, new Date());

    await logReq.query(`
      INSERT INTO QuizSubmissionRejectionLog (submissionId, staffUserId, employeeUserId, courseId, quizId, rejectionReason, rejectedAt)
      VALUES (@submissionId, @staffUserId, @userId, @courseId, @quizId, @rejectionReason, @rejectedAt)
    `);

    await transaction.commit();

    console.log(
      `✅ Submission ${submissionId} rejected. Course progress reset for user ${userId} in course ${courseId}`,
    );

    return {
      success: true,
      message:
        "Submission rejected successfully. Employee's course progress has been reset to 0% and must complete the course again from the beginning.",
      submissionId,
      quizId,
      userId,
      courseId,
    };
  } catch (err) {
    await transaction.rollback();
    console.error("Error rejecting submission:", err);
    throw new Error(`Failed to reject submission: ${err.message}`);
  }
};

/**
 * Get submission with full details including all answers and correct answers
 * STAFF: For detailed review before approval/rejection
 */
const getFullSubmissionDetails = async (submissionId) => {
  const pool = await getDbPool();

  try {
    const req = pool.request().input("submissionId", sql.Int, submissionId);

    // Get submission header info with student and course details
    const headerResult = await req.query(`
      SELECT 
        qs.id as submissionId,
        qs.quizId,
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
        q.title as quizTitle,
        q.description as quizDescription,
        c.id as courseId,
        c.title as courseName,
        q.passingScore,
        qs.score,
        qs.passed,
        qs.totalQuestions,
        qs.correctAnswers,
        qs.timeTaken,
        qs.submittedAt,
        qs.attemptNumber,
        qs.approvalStatus,
        qs.approvedBy,
        qs.approvedAt,
        qs.rejectionReason
      FROM QuizSubmissions qs
      INNER JOIN Users u ON qs.userId = u.id
      INNER JOIN Quizzes q ON qs.quizId = q.id
      INNER JOIN Courses c ON q.courseId = c.id
      WHERE qs.id = @submissionId
    `);

    if (headerResult.recordset.length === 0) {
      throw new Error("Submission not found");
    }

    const submission = headerResult.recordset[0];

    // Get all questions with options (using quizId from submission)
    const questionsResult = await pool
      .request()
      .input("quizId", sql.Int, submission.quizId).query(`
      SELECT 
        qq.id as questionId,
        qq.question as questionText,
        qq.explanation,
        qo.id as optionId,
        qo.optionText,
        qo.isCorrect,
        qo.optionOrder
      FROM QuizQuestions qq
      LEFT JOIN QuizOptions qo ON qq.id = qo.questionId
      WHERE qq.quizId = @quizId
      ORDER BY qq.questionOrder, qo.optionOrder
    `);

    console.log(
      `🔍 Found ${questionsResult.recordset.length} rows for quizId ${submission.quizId}`,
    );
    questionsResult.recordset.forEach((row, idx) => {
      console.log(
        `  Row ${idx}: questionId=${row.questionId}, optionId=${row.optionId}, optionText="${row.optionText}", isCorrect=${row.isCorrect}`,
      );
    });

    // Get student's answers
    const answersResult = await pool
      .request()
      .input("submissionId", sql.Int, submissionId).query(`
      SELECT 
        qa.questionId,
        qa.selectedOptionId,
        qa.selectedOptionText,
        qa.isCorrect as answerIsCorrect
      FROM QuizAnswers qa
      WHERE qa.submissionId = @submissionId
    `);

    // Structure questions with options and student's answers
    const questionMap = new Map();
    questionsResult.recordset.forEach((row) => {
      if (!questionMap.has(row.questionId)) {
        questionMap.set(row.questionId, {
          questionId: row.questionId,
          questionText: row.questionText,
          explanation: row.explanation,
          options: [],
        });
      }
      if (row.optionId) {
        console.log(
          `📌 Question ${row.questionId} Option: "${row.optionText}", isCorrect: ${row.isCorrect}`,
        );
        questionMap.get(row.questionId).options.push({
          optionId: row.optionId,
          optionText: row.optionText,
          isCorrect: row.isCorrect === true || row.isCorrect === 1,
        });
      }
    });

    // Add student's answers to questions
    const answerMap = new Map();
    answersResult.recordset.forEach((answer) => {
      answerMap.set(answer.questionId, {
        selectedOptionId: answer.selectedOptionId,
        selectedOptionText: answer.selectedOptionText,
        isCorrect:
          answer.answerIsCorrect === true || answer.answerIsCorrect === 1,
      });
    });

    const questionsWithAnswers = Array.from(questionMap.values()).map((q) => {
      const studentAnswer = answerMap.get(q.questionId);
      return {
        ...q,
        options: q.options.map((opt) => ({
          ...opt,
          isCorrect: opt.isCorrect === true || opt.isCorrect === 1, // Ensure boolean
        })),
        studentAnswer: studentAnswer || {
          selectedOptionId: null,
          selectedOptionText: null,
          isCorrect: false,
        },
      };
    });

    // Transform submission object to match frontend expectations
    const transformedSubmission = {
      id: submission.submissionId,
      studentName: `${submission.firstName} ${submission.lastName}`.trim(),
      studentEmail: submission.email,
      courseName: submission.courseName,
      quizTitle: submission.quizTitle,
      score: submission.score,
      totalQuestions: submission.totalQuestions,
      correctAnswers: submission.correctAnswers,
      passed: submission.passed === true || submission.passed === 1,
      passingScore: submission.passingScore,
      timeTaken: submission.timeTaken,
      submittedAt: submission.submittedAt,
      approvalStatus: submission.approvalStatus || "pending",
      approvedBy: submission.approvedBy,
      approvedAt: submission.approvedAt,
      rejectionReason: submission.rejectionReason,
    };

    return {
      submission: transformedSubmission,
      questions: questionsWithAnswers,
    };
  } catch (err) {
    console.error("Error getting full submission details:", err);
    throw new Error(`Failed to fetch submission details: ${err.message}`);
  }
};

/**
 * Reset quiz attempts for an employee
 * Deletes the submission so employee can retake the quiz
 * STAFF: Only instructors, managers, and admins can use this
 */
const resetQuizAttempts = async (submissionId, staffUserId) => {
  const pool = await getDbPool();
  const transaction = pool.transaction();

  try {
    await transaction.begin();

    // Get submission details before deletion
    let getReq = transaction
      .request()
      .input("submissionId", sql.Int, submissionId);
    const submissionResult = await getReq.query(`
      SELECT quizId, userId FROM QuizSubmissions WHERE id = @submissionId
    `);

    if (submissionResult.recordset.length === 0) {
      await transaction.rollback();
      throw new Error("Submission not found");
    }

    const { quizId, userId } = submissionResult.recordset[0];

    // Delete associated quiz answers
    let deleteAnswersReq = transaction
      .request()
      .input("submissionId", sql.Int, submissionId);
    await deleteAnswersReq.query(`
      DELETE FROM QuizAnswers WHERE submissionId = @submissionId
    `);

    // Delete the submission
    let deleteReq = transaction
      .request()
      .input("submissionId", sql.Int, submissionId);
    const deleteResult = await deleteReq.query(`
      DELETE FROM QuizSubmissions WHERE id = @submissionId
      SELECT @@ROWCOUNT as rowsAffected
    `);

    if (deleteResult.recordset[0].rowsAffected === 0) {
      await transaction.rollback();
      throw new Error("Failed to delete submission");
    }

    await transaction.commit();

    return {
      success: true,
      message:
        "Quiz attempts have been reset successfully. Employee can now retake the quiz.",
      submissionId,
      quizId,
      userId,
    };
  } catch (err) {
    await transaction.rollback();
    console.error("Error resetting quiz attempts:", err);
    throw new Error(`Failed to reset quiz attempts: ${err.message}`);
  }
};

/**
 * Diagnostic: Get quiz options to check correctness
 */
const getQuizDiagnostics = async (quizId) => {
  const pool = await getDbPool();
  try {
    const result = await pool.request().input("quizId", sql.Int, quizId).query(`
        SELECT 
          q.id as quizId,
          q.title,
          qq.id as questionId,
          qq.question,
          qo.id as optionId,
          qo.optionText,
          qo.isCorrect,
          COUNT(*) OVER (PARTITION BY qq.id) as optionCount,
          SUM(CAST(qo.isCorrect AS INT)) OVER (PARTITION BY qq.id) as correctCount
        FROM Quizzes q
        JOIN QuizQuestions qq ON q.id = qq.quizId
        LEFT JOIN QuizOptions qo ON qq.id = qo.questionId
        WHERE q.id = @quizId
        ORDER BY qq.questionOrder, qo.optionOrder
      `);

    const issues = [];
    const questionMap = new Map();

    result.recordset.forEach((row) => {
      if (!questionMap.has(row.questionId)) {
        questionMap.set(row.questionId, {
          questionId: row.questionId,
          question: row.question,
          optionCount: row.optionCount,
          correctCount: row.correctCount,
          options: [],
        });

        if (row.correctCount === 0 && row.optionCount > 0) {
          issues.push({
            type: "NO_CORRECT_ANSWER",
            questionId: row.questionId,
            question: row.question,
            message: `Question has ${row.optionCount} options but none marked as correct`,
          });
        }
      }

      if (row.optionId) {
        questionMap.get(row.questionId).options.push({
          optionId: row.optionId,
          optionText: row.optionText,
          isCorrect: row.isCorrect === 1,
        });
      }
    });

    return {
      quizId,
      hasIssues: issues.length > 0,
      issues,
      summary: {
        totalQuestions: questionMap.size,
        questionsWithoutCorrectAnswer: issues.length,
      },
    };
  } catch (err) {
    throw new Error(`Failed to get quiz diagnostics: ${err.message}`);
  }
};

module.exports = {
  createOrUpdateQuiz,
  getQuizByCourse,
  deleteQuiz,
  canAttemptQuiz,
  submitQuizAnswers,
  getQuizResults,
  getUserQuizHistory,
  getCourseQuizSubmissions,
  getAllQuizSubmissions,
  getSubmissionDetails,
  checkQuizAttempt,
  approveSubmission,
  rejectSubmission,
  getFullSubmissionDetails,
  resetQuizAttempts,
  getQuizDiagnostics,
};
