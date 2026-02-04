require("dotenv").config();
const { getDbPool, sql } = require("../src/config/db");

async function checkSchema() {
  const pool = await getDbPool();
  const res = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'QuizOptions' AND COLUMN_NAME = 'isCorrect'
  `);
  console.log("Schema for isCorrect column:");
  console.log(JSON.stringify(res.recordset, null, 2));
  process.exit(0);
}
checkSchema();
