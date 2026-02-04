require("dotenv").config();
const { getDbPool, sql } = require("../src/config/db");

async function checkIds() {
  const pool = await getDbPool();

  // Get quiz 3 questions
  const qres = await pool.request().input("quizId", sql.Int, 3).query(`
      SELECT qq.id as questionId, qq.question, qo.id as optionId, qo.optionText, qo.isCorrect
      FROM QuizQuestions qq
      LEFT JOIN QuizOptions qo ON qq.id = qo.questionId
      WHERE qq.quizId = 3
      ORDER BY qo.optionOrder
    `);

  console.log("Quiz 3 with options:");
  const qMap = new Map();
  for (const row of qres.recordset) {
    if (!qMap.has(row.questionId)) {
      qMap.set(row.questionId, {
        id: row.questionId,
        text: row.question,
        options: [],
      });
    }
    if (row.optionId) {
      qMap.get(row.questionId).options.push({
        id: row.optionId,
        text: row.optionText,
        isCorrect: row.isCorrect,
      });
    }
  }

  for (const [, q] of qMap) {
    console.log(`\nQuestion ${q.id}: ${q.text}`);
    for (const opt of q.options) {
      const mark = opt.isCorrect ? "✅" : "❌";
      console.log(`  Option ${opt.id}: ${opt.text} ${mark}`);
    }
  }

  process.exit(0);
}

checkIds();
