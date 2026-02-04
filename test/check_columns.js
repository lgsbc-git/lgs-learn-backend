require("dotenv").config();
const { getDbPool, sql } = require("../src/config/db");

async function check() {
  const pool = await getDbPool();
  const res = await pool.request().query(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'QuizAnswers'
  `);
  console.log(
    "QuizAnswers columns:",
    res.recordset.map((r) => r.COLUMN_NAME).join(", "),
  );
  process.exit(0);
}
check().catch((e) => {
  console.error(e);
  process.exit(1);
});
