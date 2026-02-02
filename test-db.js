/**
 * Test database connection and verify QuizAnswers columns
 */

const sql = require("mssql");
const env = require("./src/config/env");

const dbConfig = {
  user: env.db.user,
  password: env.db.password,
  server: env.db.server,
  database: env.db.database,
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
};

const testDatabase = async () => {
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    console.log("✅ Connected to database");

    // Check QuizAnswers table columns
    const result = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'QuizAnswers'
      ORDER BY ORDINAL_POSITION
    `);

    console.log("\n📋 QuizAnswers table columns:");
    result.recordset.forEach((col) => {
      console.log(`  - ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
    });

    // Check if questionText and selectedOptionText exist
    const questionTextExists = result.recordset.some(
      (col) => col.COLUMN_NAME === "questionText",
    );
    const selectedOptionTextExists = result.recordset.some(
      (col) => col.COLUMN_NAME === "selectedOptionText",
    );

    console.log(
      "\n✅ questionText column:",
      questionTextExists ? "EXISTS" : "MISSING",
    );
    console.log(
      "✅ selectedOptionText column:",
      selectedOptionTextExists ? "EXISTS" : "MISSING",
    );

    // Check QuizOptions table columns
    const optionsResult = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'QuizOptions'
      ORDER BY ORDINAL_POSITION
    `);

    console.log("\n📋 QuizOptions table columns:");
    optionsResult.recordset.forEach((col) => {
      console.log(`  - ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
    });

    // Check if optionText exists
    const optionTextExists = optionsResult.recordset.some(
      (col) => col.COLUMN_NAME === "optionText",
    );

    console.log(
      "\n✅ optionText column:",
      optionTextExists ? "EXISTS" : "MISSING",
    );

    await pool.close();
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
};

testDatabase();
