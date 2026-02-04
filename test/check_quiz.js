// Quick script to check quiz options in database for course 23
require("dotenv").config();
const { getDbPool, sql } = require("../src/config/db");

async function checkQuizDatabase() {
  try {
    const pool = await getDbPool();

    // Get quiz for course 23
    const quizRes = await pool.request().input("courseId", sql.Int, 23).query(`
        SELECT id, title, courseId FROM Quizzes WHERE courseId = @courseId
      `);

    if (quizRes.recordset.length === 0) {
      console.log("❌ No quiz found for course 23");
      process.exit(0);
    }

    const quiz = quizRes.recordset[0];
    console.log(`\n📋 Quiz found: "${quiz.title}" (ID: ${quiz.id})\n`);

    // Get all questions for this quiz
    const questionsRes = await pool.request().input("quizId", sql.Int, quiz.id)
      .query(`
        SELECT id, question, questionOrder FROM QuizQuestions WHERE quizId = @quizId
        ORDER BY questionOrder
      `);

    console.log(`Found ${questionsRes.recordset.length} question(s):\n`);

    // For each question, get options
    for (const question of questionsRes.recordset) {
      console.log(
        `❓ Question ${question.questionOrder}: "${question.question}"`,
      );

      const optionsRes = await pool
        .request()
        .input("questionId", sql.Int, question.id).query(`
          SELECT id, optionText, isCorrect, optionOrder FROM QuizOptions 
          WHERE questionId = @questionId
          ORDER BY optionOrder
        `);

      console.log(`   Options:`);
      for (const opt of optionsRes.recordset) {
        const isCorrectValue =
          opt.isCorrect === true || opt.isCorrect === 1 ? 1 : 0;
        const correctMarker = isCorrectValue === 1 ? "✅ CORRECT" : "❌ WRONG";
        console.log(
          `   ${opt.optionOrder}. "${opt.optionText}" - isCorrect: ${isCorrectValue} ${correctMarker}`,
        );
      }
      console.log("");
    }

    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

checkQuizDatabase();
