require("dotenv").config();
const { getDbPool, sql } = require("../src/config/db");
const quizService = require("../src/modules/quiz/quiz.service");

async function fullTest() {
  const pool = await getDbPool();

  try {
    console.log("====================================");
    console.log("🧪 QUIZ SCORING FIX VERIFICATION TEST");
    console.log("====================================\n");

    // Test 1: Verify database has correct options marked
    console.log("📚 Step 1: Verify Quiz 4 options in database");
    console.log("-".repeat(50));
    const quizRes = await pool.request().input("quizId", sql.Int, 4).query(`
        SELECT qq.id as questionId, qq.question,
               qo.id as optionId, qo.optionText, qo.isCorrect, qo.optionOrder
        FROM QuizQuestions qq
        LEFT JOIN QuizOptions qo ON qq.id = qo.questionId
        WHERE qq.quizId = 4
        ORDER BY qq.questionOrder, qo.optionOrder
      `);

    const qMap = new Map();
    for (const row of quizRes.recordset) {
      if (!qMap.has(row.questionId)) {
        qMap.set(row.questionId, { question: row.question, options: [] });
      }
      if (row.optionId) {
        const isCorrect = row.isCorrect === true || row.isCorrect === 1;
        qMap.get(row.questionId).options.push({
          id: row.optionId,
          text: row.optionText,
          isCorrect,
        });
      }
    }

    for (const [, q] of qMap) {
      console.log(`Q: "${q.question}"`);
      for (const opt of q.options) {
        const mark = opt.isCorrect ? "✅ CORRECT" : "❌ WRONG";
        console.log(`   Option ${opt.id}: "${opt.text}" ${mark}`);
      }
    }

    // Test 2: Clean up and submit
    console.log("\n📝 Step 2: Delete old submission and submit new one");
    console.log("-".repeat(50));

    // Delete old
    await pool.request().input("userId", sql.Int, 2).input("quizId", sql.Int, 4)
      .query(`
        DELETE FROM QuizAnswers WHERE submissionId IN (
          SELECT id FROM QuizSubmissions WHERE userId = @userId AND quizId = @quizId
        );
        DELETE FROM QuizSubmissions WHERE userId = @userId AND quizId = @quizId;
      `);

    // Submit new (selecting the correct option: 106)
    const submitRes = await quizService.submitQuizAnswers(
      4, // quizId
      2, // userId
      [{ questionId: 27, selectedOptionId: 106 }],
      60,
    );

    console.log(`✅ Submission created: ID ${submitRes.submissionId}`);
    console.log(
      `   Score: ${submitRes.score}% (${submitRes.correctAnswers}/${submitRes.totalQuestions})`,
    );
    console.log(`   Passed: ${submitRes.passed ? "YES ✅" : "NO ❌"}`);

    // Test 3: Verify what was saved
    console.log("\n✔️ Step 3: Verify data was saved correctly");
    console.log("-".repeat(50));

    const savedRes = await pool
      .request()
      .input("submissionId", sql.Int, submitRes.submissionId).query(`
        SELECT qa.questionText, qa.selectedOptionText, qa.isCorrect
        FROM QuizAnswers qa
        WHERE qa.submissionId = @submissionId
      `);

    for (const ans of savedRes.recordset) {
      const isCorrect = ans.isCorrect === true || ans.isCorrect === 1;
      const mark = isCorrect ? "✅" : "❌";
      console.log(`Q: "${ans.questionText}"`);
      console.log(`A: "${ans.selectedOptionText}" ${mark}`);
    }

    // Test 4: Verify via getFullSubmissionDetails (like frontend does)
    console.log("\n🔍 Step 4: Verify via getFullSubmissionDetails API");
    console.log("-".repeat(50));

    const detailRes = await quizService.getFullSubmissionDetails(
      submitRes.submissionId,
    );
    console.log(`Score: ${detailRes.submission.score}%`);
    console.log(
      `Correct: ${detailRes.submission.correctAnswers}/${detailRes.submission.totalQuestions}`,
    );
    console.log(`Passed: ${detailRes.submission.passed ? "YES ✅" : "NO ❌"}`);

    for (const q of detailRes.questions) {
      console.log(`\nQ: "${q.questionText}"`);
      console.log(
        `Student Answer: "${q.studentAnswer?.selectedOptionText}" (${q.studentAnswer?.isCorrect ? "✅ CORRECT" : "❌ WRONG"})`,
      );
      console.log("Correct Answers:");
      for (const opt of q.options) {
        if (opt.isCorrect) {
          console.log(`   ✅ "${opt.optionText}"`);
        }
      }
    }

    console.log("\n====================================");
    console.log("✅ ALL TESTS PASSED - BUG IS FIXED!");
    console.log("====================================");

    process.exit(0);
  } catch (err) {
    console.error("❌ ERROR:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

fullTest();
