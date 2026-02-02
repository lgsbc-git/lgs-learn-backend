/**
 * Database Migration: Add Approval Workflow to QuizSubmissions
 * Allows staff to approve/reject quiz submissions for certification
 */

const { getDbPool, sql } = require("../config/db");

/**
 * Add approval columns to QuizSubmissions table if they don't exist
 */
const migrateApprovalWorkflow = async () => {
  try {
    const pool = await getDbPool();

    // Add approvalStatus column if it doesn't exist
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'QuizSubmissions' AND COLUMN_NAME = 'approvalStatus'
      )
      BEGIN
        ALTER TABLE QuizSubmissions
        ADD approvalStatus NVARCHAR(20) DEFAULT 'pending';
        PRINT 'Added approvalStatus column to QuizSubmissions';
      END
    `);

    // Add approvedBy column if it doesn't exist
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'QuizSubmissions' AND COLUMN_NAME = 'approvedBy'
      )
      BEGIN
        ALTER TABLE QuizSubmissions
        ADD approvedBy INT NULL;
        PRINT 'Added approvedBy column to QuizSubmissions';
      END
    `);

    // Add approvedAt column if it doesn't exist
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'QuizSubmissions' AND COLUMN_NAME = 'approvedAt'
      )
      BEGIN
        ALTER TABLE QuizSubmissions
        ADD approvedAt DATETIME2 NULL;
        PRINT 'Added approvedAt column to QuizSubmissions';
      END
    `);

    // Add rejectionReason column if it doesn't exist
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'QuizSubmissions' AND COLUMN_NAME = 'rejectionReason'
      )
      BEGIN
        ALTER TABLE QuizSubmissions
        ADD rejectionReason NVARCHAR(MAX) NULL;
        PRINT 'Added rejectionReason column to QuizSubmissions';
      END
    `);

    // Create index for approval queries
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_submissions_approval')
      BEGIN
        CREATE INDEX idx_submissions_approval 
        ON QuizSubmissions(approvalStatus, userId);
        PRINT 'Created approval status index';
      END
    `);

    console.log("✅ Approval workflow migration completed successfully");
    return true;
  } catch (err) {
    console.error("❌ Approval workflow migration error:", err.message);
    console.warn(
      "⚠️  Migration failed, approval features may not work properly",
    );
    return false;
  }
};

module.exports = {
  migrateApprovalWorkflow,
};
