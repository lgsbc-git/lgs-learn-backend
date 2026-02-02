/**
 * Database Migrations for Quiz System
 * Adds required columns to QuizAnswers table if they don't exist
 */

const { getDbPool, sql } = require("../config/db");

/**
 * Ensure QuizAnswers table has required columns
 */
const migrateQuizAnswersTable = async () => {
  try {
    const pool = await getDbPool();

    // Add questionText column if it doesn't exist
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'QuizAnswers' AND COLUMN_NAME = 'questionText'
      )
      BEGIN
        ALTER TABLE QuizAnswers
        ADD questionText NVARCHAR(MAX);
        PRINT 'Added questionText column to QuizAnswers';
      END
    `);

    // Add selectedOptionText column if it doesn't exist
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'QuizAnswers' AND COLUMN_NAME = 'selectedOptionText'
      )
      BEGIN
        ALTER TABLE QuizAnswers
        ADD selectedOptionText NVARCHAR(MAX);
        PRINT 'Added selectedOptionText column to QuizAnswers';
      END
    `);

    console.log("✅ Quiz database migrations completed successfully");
    return true;
  } catch (err) {
    console.error("❌ Quiz migration error:", err.message);
    // Don't fail the entire server, just log the warning
    console.warn("⚠️  Migration failed, quiz feature may not work properly");
    return false;
  }
};

/**
 * Run all database migrations
 */
const runMigrations = async () => {
  try {
    console.log("🔄 Running database migrations...");
    await migrateQuizAnswersTable();

    // Import and run approval workflow migration
    const { migrateApprovalWorkflow } = require("./approval-workflow");
    await migrateApprovalWorkflow();
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
  }
};

module.exports = {
  runMigrations,
};
