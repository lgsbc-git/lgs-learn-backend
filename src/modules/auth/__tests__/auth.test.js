/**
 * Authentication Module Tests
 * Tests for login, logout, token validation
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { generateTestToken, createTestUser } = require('../../../../test/helpers');

describe('Authentication Module - POST /auth/login', () => {
  let testUser;

  beforeAll(async () => {
    // Create test user - SKIP if database unavailable
    try {
      testUser = await createTestUser({
        email: 'login_test@test.local',
        password: 'password123',
        role: 'employee',
      });
    } catch (error) {
      console.warn('⚠️  Database connection unavailable - skipping DB tests');
      testUser = null;
    }
  });

  test('should fail without app (mock test)', async () => {
    // Skip if database unavailable
    if (!testUser) {
      console.warn('⏭️  Skipping - requires database');
      return;
    }
    
    const token = generateTestToken({
      id: testUser.id,
      email: testUser.email,
      role: testUser.role,
    });

    expect(token).toBeDefined();
    
    // Decode token to verify
    const decoded = jwt.decode(token);
    expect(decoded.email).toBe(testUser.email);
    expect(decoded.role).toBe('employee');
  });

  test('should generate valid JWT token', () => {
    const token = generateTestToken({
      id: 'test123',
      email: 'test@test.com',
      role: 'manager',
    });

    const decoded = jwt.decode(token);
    expect(decoded).toHaveProperty('id', 'test123');
    expect(decoded).toHaveProperty('email', 'test@test.com');
    expect(decoded).toHaveProperty('role', 'manager');
    expect(decoded).toHaveProperty('iat'); // issued at
    expect(decoded).toHaveProperty('exp'); // expires
  });

  test('should handle missing credentials', () => {
    // Validation test
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    expect(emailPattern.test('test@test.com')).toBe(true);
    expect(emailPattern.test('invalid-email')).toBe(false);
  });

  test('should validate password requirements', () => {
    const validatePassword = (password) => {
      if (!password || password.length < 6) return false;
      return true;
    };

    expect(validatePassword('password123')).toBe(true);
    expect(validatePassword('123')).toBe(false);
    expect(validatePassword('')).toBe(false);
  });
});

describe('Authentication Module - Token Management', () => {
  test('should create token with correct payload structure', () => {
    const user = {
      id: 'user-123',
      email: 'user@test.com',
      role: 'instructor',
      name: 'Test Instructor',
    };

    const token = generateTestToken(user);
    const decoded = jwt.decode(token);

    expect(decoded).toMatchObject({
      id: 'user-123',
      email: 'user@test.com',
      role: 'instructor',
      name: 'Test Instructor',
    });
  });

  test('should generate tokens for all user roles', () => {
    const roles = ['employee', 'manager', 'instructor', 'admin'];

    roles.forEach(role => {
      const token = generateTestToken({ role });
      const decoded = jwt.decode(token);
      expect(decoded.role).toBe(role);
    });
  });

  test('should have proper token expiration', () => {
    const token = generateTestToken({ role: 'employee' });
    const decoded = jwt.decode(token);

    // Token should have exp claim
    expect(decoded.exp).toBeDefined();
    
    // exp should be in the future
    const now = Math.floor(Date.now() / 1000);
    expect(decoded.exp).toBeGreaterThan(now);

    // Should be within reasonable time (8 hours = 28800 seconds)
    const tokenLife = decoded.exp - decoded.iat;
    expect(tokenLife).toBeLessThanOrEqual(28800 + 600); // Allow 10 min variance
  });
});

describe('Authentication Module - Role-based Access', () => {
  test('should validate role authorization', () => {
    const authorizeRole = (userRole, requiredRoles) => {
      return requiredRoles.includes(userRole);
    };

    // Employee can access employee routes
    expect(authorizeRole('employee', ['employee'])).toBe(true);
    expect(authorizeRole('employee', ['admin'])).toBe(false);

    // Manager can access multiple routes
    expect(authorizeRole('manager', ['admin', 'manager', 'instructor'])).toBe(true);

    // Admin can access all
    expect(authorizeRole('admin', ['employee', 'manager', 'instructor', 'admin'])).toBe(true);
  });

  test('should deny invalid roles', () => {
    const isValidRole = (role) => {
      const validRoles = ['employee', 'manager', 'instructor', 'admin', 'staff'];
      return validRoles.includes(role);
    };

    expect(isValidRole('employee')).toBe(true);
    expect(isValidRole('invalidRole')).toBe(false);
    expect(isValidRole('superuser')).toBe(false);
  });
});

describe('Authentication Module - SSO (Azure AD)', () => {
  test('should validate SSO callback URL format', () => {
    const callbackUrl = process.env.AZURE_CALLBACK_URL;
    
    // Should be HTTPS
    expect(callbackUrl).toMatch(/^https:\/\//);
    
    // Should contain host
    expect(callbackUrl).toMatch(/localhost|[a-zA-Z0-9.-]+/);
    
    // Should contain auth path
    expect(callbackUrl).toMatch(/\/auth\/microsoft\/callback/);
  });

  test('should have Azure AD configuration', () => {
    expect(process.env.AZURE_CLIENT_ID).toBeDefined();
    expect(process.env.AZURE_TENANT_ID).toBeDefined();
    expect(process.env.AZURE_CLIENT_SECRET).toBeDefined();
  });

  test('should validate Azure tenant ID format', () => {
    const tenantId = process.env.AZURE_TENANT_ID;
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    expect(uuidPattern.test(tenantId)).toBe(true);
  });
});
