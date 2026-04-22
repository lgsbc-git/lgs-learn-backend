/**
 * Test Helpers & Utilities
 */

const jwt = require('jsonwebtoken');
const { connectTestDatabase } = require('./setup');

/**
 * Generate JWT token for testing
 */
function generateTestToken(user = {}) {
  const payload = {
    id: user.id || 'test_user_001',
    email: user.email || 'test@test.local',
    role: user.role || 'employee',
    name: user.name || 'Test User',
  };

  return jwt.sign(payload, process.env.JWT_SECRET || 'test-secret', {
    expiresIn: '8h',
  });
}

/**
 * Create a test user in database
 */
async function createTestUser(userData = {}) {
  const pool = await connectTestDatabase();
  const request = pool.request();

  const user = {
    id: userData.id || `test_${Date.now()}`,
    email: userData.email || `test_${Date.now()}@test.local`,
    name: userData.name || 'Test User',
    passwordHash: userData.passwordHash || '$2b$10$test', // bcrypt hash of 'password123'
    role: userData.role || 'employee',
    isActive: userData.isActive !== undefined ? userData.isActive : 1,
  };

  try {
    await request
      .input('id', require('mssql').NVarChar(50), user.id)
      .input('email', require('mssql').NVarChar(255), user.email)
      .input('name', require('mssql').NVarChar(255), user.name)
      .input('passwordHash', require('mssql').NVarChar, user.passwordHash)
      .input('role', require('mssql').NVarChar(50), user.role)
      .input('isActive', require('mssql').Bit, user.isActive)
      .query(`
        INSERT INTO Users (id, email, name, passwordHash, role, isActive, createdAt, updatedAt)
        VALUES (@id, @email, @name, @passwordHash, @role, @isActive, GETUTCDATE(), GETUTCDATE())
      `);

    return user;
  } catch (error) {
    if (error.message.includes('PRIMARY KEY')) {
      return user; // User already exists
    }
    throw error;
  }
}

/**
 * Delete test user
 */
async function deleteTestUser(userId) {
  const pool = await connectTestDatabase();
  const request = pool.request();

  try {
    await request.input('id', require('mssql').NVarChar(50), userId).query(`
      DELETE FROM Users WHERE id = @id
    `);
  } catch (error) {
    console.warn('Delete user error:', error.message);
  }
}

/**
 * Create a test course
 */
async function createTestCourse(courseData = {}) {
  const pool = await connectTestDatabase();
  const request = pool.request();

  const course = {
    id: courseData.id || `test_course_${Date.now()}`,
    title: courseData.title || 'Test Course',
    description: courseData.description || 'Test course description',
    createdBy: courseData.createdBy || 'test_user_001',
  };

  try {
    await request
      .input('id', require('mssql').NVarChar(50), course.id)
      .input('title', require('mssql').NVarChar(255), course.title)
      .input('description', require('mssql').NVarChar, course.description)
      .input('createdBy', require('mssql').NVarChar(50), course.createdBy)
      .query(`
        INSERT INTO Courses (id, title, description, createdBy, createdAt, updatedAt)
        VALUES (@id, @title, @description, @createdBy, GETUTCDATE(), GETUTCDATE())
      `);

    return course;
  } catch (error) {
    console.warn('Create course error:', error.message);
    return course;
  }
}

/**
 * Create a test quiz
 */
async function createTestQuiz(quizData = {}) {
  const pool = await connectTestDatabase();
  const request = pool.request();

  const quiz = {
    id: quizData.id || `test_quiz_${Date.now()}`,
    courseId: quizData.courseId || `test_course_${Date.now()}`,
    title: quizData.title || 'Test Quiz',
    passingScore: quizData.passingScore || 70,
    timeLimit: quizData.timeLimit || 30,
  };

  try {
    await request
      .input('id', require('mssql').NVarChar(50), quiz.id)
      .input('courseId', require('mssql').NVarChar(50), quiz.courseId)
      .input('title', require('mssql').NVarChar(255), quiz.title)
      .input('passingScore', require('mssql').Int, quiz.passingScore)
      .input('timeLimit', require('mssql').Int, quiz.timeLimit)
      .query(`
        INSERT INTO Quizzes (id, courseId, title, passingScore, timeLimit, createdAt, updatedAt)
        VALUES (@id, @courseId, @title, @passingScore, @timeLimit, GETUTCDATE(), GETUTCDATE())
      `);

    return quiz;
  } catch (error) {
    console.warn('Create quiz error:', error.message);
    return quiz;
  }
}

/**
 * Wait for condition to be true
 */
async function waitFor(condition, timeout = 5000, interval = 100) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

module.exports = {
  generateTestToken,
  createTestUser,
  deleteTestUser,
  createTestCourse,
  createTestQuiz,
  waitFor,
};
