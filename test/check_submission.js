require("dotenv").config();
const { getDbPool, sql } = require("../src/config/db");

async function checkSubmission() {
  const pool = await getDbPool();

  // Get the most recent submission for course 23's quiz
  const submissionRes = await pool.request().input("courseId", sql.Int, 23)
    .query(`
      SELECT TOP 1 qs.id, qs.quizId, qs.userId, qs.score, qs.correctAnswers, qs.totalQuestions,
             u.name, q.title as quizTitle
      FROM QuizSubmissions qs
      JOIN Quizzes q ON qs.quizId = q.id
      JOIN Users u ON qs.userId = u.id
      WHERE q.courseId = @courseId
      ORDER BY qs.submittedAt DESC
    `);

  if (submissionRes.recordset.length === 0) {
    console.log("❌ No submissions found for course 23");
    process.exit(0);
  }

  const submission = submissionRes.recordset[0];
  console.log(`\n📝 Latest Submission:`);
  console.log(`   Student: ${submission.name}`);
  console.log(`   Quiz: "${submission.quizTitle}"`);
  console.log(`   Score: ${submission.score}%`);
  console.log(
    `   Correct: ${submission.correctAnswers}/${submission.totalQuestions}\n`,
  );

  // Get the answers for this submission
  const answersRes = await pool
    .request()
    .input("submissionId", sql.Int, submission.id).query(`
      SELECT qa.id, qa.questionId, qa.selectedOptionId, qa.selectedOptionText, qa.isCorrect,
             qa.questionText
      FROM QuizAnswers qa
      WHERE qa.submissionId = @submissionId
      ORDER BY qa.questionId
    `);

  console.log(`📋 Student Answers:`);
  for (const answer of answersRes.recordset) {
    const isCorrect = answer.isCorrect === 1 || answer.isCorrect === true;
    const marker = isCorrect ? "✅" : "❌";
    console.log(`\n   Question: "${answer.questionText}"`);
    console.log(
      `   Student Selected (Option ID ${answer.selectedOptionId}): "${answer.selectedOptionText}"`,
    );
    console.log(`   Marked Correct: ${isCorrect} ${marker}`);
  }

  // Now get the quiz options to see what the correct answer actually is
  const optionsRes = await pool
    .request()
    .input("quizId", sql.Int, submission.quizId).query(`
      SELECT qq.id as questionId, qq.question,
             qo.id as optionId, qo.optionText, qo.isCorrect, qo.optionOrder
      FROM QuizQuestions qq
      LEFT JOIN QuizOptions qo ON qq.id = qo.questionId
      WHERE qq.quizId = @quizId
      ORDER BY qq.questionOrder, qo.optionOrder
    `);

  console.log(`\n\n📚 Quiz Content (What the correct answers should be):`);
  const qMap = new Map();
  for (const row of optionsRes.recordset) {
    if (!qMap.has(row.questionId)) {
      qMap.set(row.questionId, { question: row.question, options: [] });
    }
    if (row.optionId) {
      qMap.get(row.questionId).options.push({
        id: row.optionId,
        text: row.optionText,
        isCorrect: row.isCorrect === 1 || row.isCorrect === true,
      });
    }
  }

  for (const [qid, q] of qMap) {
    console.log(`\n   Q: "${q.question}"`);
    for (const opt of q.options) {
      const marker = opt.isCorrect ? "✅ CORRECT" : "❌ WRONG";
      console.log(`      - (ID ${opt.id}) "${opt.text}" ${marker}`);
    }
  }

  process.exit(0);
}

checkSubmission().catch((e) => {
  console.error(e);
  process.exit(1);
});
