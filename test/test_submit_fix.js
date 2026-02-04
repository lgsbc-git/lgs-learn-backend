require("dotenv").config();
const { getDbPool, sql } = require("../src/config/db");

async function cleanupAndTest() {
  const pool = await getDbPool();

  try {
    // Delete the old submission for Employee Test (user 2) on the ETL quiz (quiz 3)
    console.log("Deleting previous submission to test the fix...");

    const deleteRes = await pool
      .request()
      .input("userId", sql.Int, 2)
      .input("quizId", sql.Int, 4).query(`
        DELETE FROM QuizAnswers WHERE submissionId IN (
          SELECT id FROM QuizSubmissions 
          WHERE userId = @userId AND quizId = @quizId
        );
        DELETE FROM QuizSubmissions 
        WHERE userId = @userId AND quizId = @quizId;
      `);

    console.log("✅ Old submission deleted\n");

    // Now test the submit
    const quizService = require("../src/modules/quiz/quiz.service");

    const result = await quizService.submitQuizAnswers(
      4, // quizId (Demo test mcq)
      2, // userId (Employee Test)
      [
        {
          questionId: 27, // The "what is etl?" question (Quiz 4)
          selectedOptionId: 106, // The "extraction, transform, load" option
        },
      ],
      60, // timeTaken in seconds
    );

    console.log(
      "✅ Quiz submission successful:",
      JSON.stringify(result, null, 2),
    );

    // Check what was saved
    const check = await pool
      .request()
      .input("userId", sql.Int, 2)
      .input("quizId", sql.Int, 4).query(`
        SELECT id, score, correctAnswers, totalQuestions, passed
        FROM QuizSubmissions
        WHERE userId = @userId AND quizId = @quizId
        ORDER BY id DESC
      `);

    if (check.recordset.length > 0) {
      const submission = check.recordset[0];
      console.log("\n📝 New Submission saved:");
      console.log(`   Score: ${submission.score}%`);
      console.log(
        `   Correct: ${submission.correctAnswers}/${submission.totalQuestions}`,
      );
      console.log(`   Passed: ${submission.passed === 1 ? "YES ✅" : "NO ❌"}`);

      // Get the answer details
      const answers = await pool
        .request()
        .input("submissionId", sql.Int, submission.id).query(`
          SELECT questionText, selectedOptionText, isCorrect
          FROM QuizAnswers
          WHERE submissionId = @submissionId
        `);

      console.log("\n   Answers saved:");
      for (const ans of answers.recordset) {
        const marker = ans.isCorrect === 1 ? "✅" : "❌";
        console.log(`   - Q: "${ans.questionText}"`);
        console.log(`     A: "${ans.selectedOptionText}" ${marker}`);
      }
    }

    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

cleanupAndTest();
