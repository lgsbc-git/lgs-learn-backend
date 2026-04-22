/**
 * Jest Setup File - Database Configuration & Test Utilities
 * Runs before all tests
 */

const sql = require('mssql');
const bcrypt = require('bcryptjs');

// Load test environment variables
require('dotenv').config({ path: '.env.test' });

let pool = null;
let testUsers = {};
let testCourses = {};

/**
 * Connect to Test Database
 */
async function connectTestDatabase() {
  if (pool && pool.connected) {
    return pool;
  }

  const config = {
    server: process.env.TEST_DB_SERVER || 'localhost',
    database: process.env.TEST_DB_NAME || 'lmsdb_test',
    authentication: {
      type: 'default',
      options: {
        userName: process.env.TEST_DB_USER || 'sa',
        password: process.env.TEST_DB_PASSWORD || 'TestPass123!',
      },
    },
    options: {
      trustServerCertificate: true,
      encrypt: true,
      connectionTimeout: 15000,
      requestTimeout: 15000,
    },
  };

  try {
    pool = new sql.ConnectionPool(config);
    await pool.connect();
    console.log('✓ Test database connected');
    return pool;
  } catch (error) {
    console.error('✗ Test database connection failed:', error.message);
    throw error;
  }
}

/**
 * Disconnect from Test Database
 */
async function disconnectTestDatabase() {
  if (pool) {
    try {
      await pool.close();
      pool = null;
      console.log('✓ Test database disconnected');
    } catch (error) {
      console.error('✗ Disconnect error:', error.message);
    }
  }
}

/**
 * Clean up test data (delete test users & courses)
 */
async function cleanupTestData() {
  if (!pool) {
    await connectTestDatabase();
  }

  try {
    const request = pool.request();

    // Delete in reverse dependency order
    console.log('Cleaning up test data...');
    
    // Delete quiz-related data
    await request.query(`
      DELETE FROM QuizAnswers 
      WHERE submissionId IN (
        SELECT id FROM QuizSubmissions 
        WHERE userId LIKE 'test_user_%' 
        OR userId IN (SELECT id FROM Users WHERE email LIKE 'test_%@test.local')
      )
    `);

    await request.query(`
      DELETE FROM QuizSubmissions 
      WHERE userId LIKE 'test_user_%' 
      OR userId IN (SELECT id FROM Users WHERE email LIKE 'test_%@test.local')
    `);

    // Delete course-related data
    await request.query(`
      DELETE FROM CourseAssignments 
      WHERE userId LIKE 'test_user_%' 
      OR userId IN (SELECT id FROM Users WHERE email LIKE 'test_%@test.local')
    `);

    await request.query(`
      DELETE FROM LessonProgress 
      WHERE userId LIKE 'test_user_%' 
      OR userId IN (SELECT id FROM Users WHERE email LIKE 'test_%@test.local')
    `);

    // Delete team data
    await request.query(`
      DELETE FROM TeamMembers 
      WHERE userId IN (SELECT id FROM Users WHERE email LIKE 'test_%@test.local')
      OR teamId LIKE 'test_team_%'
    `);

    await request.query(`
      DELETE FROM Teams 
      WHERE id LIKE 'test_team_%' 
      OR managerId IN (SELECT id FROM Users WHERE email LIKE 'test_%@test.local')
    `);

    // Delete courses
    await request.query(`
      DELETE FROM CourseChapters 
      WHERE moduleId IN (
        SELECT id FROM CourseModules 
        WHERE courseId IN (SELECT id FROM Courses WHERE createdBy LIKE 'test_user_%')
      )
    `);

    await request.query(`
      DELETE FROM CourseModules 
      WHERE courseId IN (SELECT id FROM Courses WHERE createdBy LIKE 'test_user_%')
    `);

    await request.query(`
      DELETE FROM QuizQuestions 
      WHERE courseId IN (SELECT id FROM Courses WHERE createdBy LIKE 'test_user_%')
    `);

    await request.query(`
      DELETE FROM Courses 
      WHERE createdBy LIKE 'test_user_%' 
      OR createdBy IN (SELECT id FROM Users WHERE email LIKE 'test_%@test.local')
    `);

    // Delete users
    await request.query(`
      DELETE FROM Users 
      WHERE email LIKE 'test_%@test.local' 
      OR id LIKE 'test_user_%'
    `);

    console.log('✓ Test data cleaned up');
  } catch (error) {
    console.error('✗ Cleanup error:', error.message);
  }
}

/**
 * Seed Test Database with Test Users
 */
async function seedTestDatabase() {
  if (!pool) {
    await connectTestDatabase();
  }

  try {
    const request = pool.request();
    
    const hashedPassword = await bcrypt.hash('password123', 10);

    // Test users
    const usersToCreate = [
      {
        id: 'test_user_emp_001',
        email: 'test_employee@test.local',
        name: 'Test Employee',
        passwordHash: hashedPassword,
        role: 'employee',
        isActive: 1,
      },
      {
        id: 'test_user_mgr_001',
        email: 'test_manager@test.local',
        name: 'Test Manager',
        passwordHash: hashedPassword,
        role: 'manager',
        isActive: 1,
      },
      {
        id: 'test_user_instr_001',
        email: 'test_instructor@test.local',
        name: 'Test Instructor',
        passwordHash: hashedPassword,
        role: 'instructor',
        isActive: 1,
      },
      {
        id: 'test_user_admin_001',
        email: 'test_admin@test.local',
        name: 'Test Admin',
        passwordHash: hashedPassword,
        role: 'admin',
        isActive: 1,
      },
    ];

    for (const user of usersToCreate) {
      try {
        await request
          .input('id', sql.NVarChar(50), user.id)
          .input('email', sql.NVarChar(255), user.email)
          .input('name', sql.NVarChar(255), user.name)
          .input('passwordHash', sql.NVarChar, user.passwordHash)
          .input('role', sql.NVarChar(50), user.role)
          .input('isActive', sql.Bit, user.isActive)
          .query(`
            INSERT INTO Users (id, email, name, passwordHash, role, isActive, createdAt, updatedAt)
            VALUES (@id, @email, @name, @passwordHash, @role, @isActive, GETUTCDATE(), GETUTCDATE())
          `);
        
        testUsers[user.role] = {
          id: user.id,
          email: user.email,
          name: user.name,
          password: 'password123',
          role: user.role,
        };
      } catch (error) {
        if (!error.message.includes('unique key')) {
          console.error(`Error creating ${user.role} user:`, error.message);
        }
      }
    }

    console.log('✓ Test database seeded with users');
    return testUsers;
  } catch (error) {
    console.error('✗ Seeding error:', error.message);
    throw error;
  }
}

/**
 * Global test setup
 */
beforeAll(async () => {
  try {
    await cleanupTestData();
    await seedTestDatabase();
  } catch (error) {
    console.warn('Setup warning:', error.message);
    // Continue even if seeding fails
  }
});

/**
 * Global test teardown
 */
afterAll(async () => {
  try {
    await cleanupTestData();
    await disconnectTestDatabase();
  } catch (error) {
    console.warn('Teardown warning:', error.message);
  }
});

// Export utilities for use in tests
module.exports = {
  connectTestDatabase,
  disconnectTestDatabase,
  cleanupTestData,
  seedTestDatabase,
  getTestusers: () => testUsers,
  sql,
  bcrypt,
};
