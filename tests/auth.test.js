'use strict';

const request = require('supertest');
const fc = require('fast-check');
const { setupTestDB, teardownTestDB, clearDatabase, getApp } = require('./test-helper');
const User = require('../server/models/User');

let app;

beforeAll(async () => {
  const setup = await setupTestDB();
  app = setup.app;
});

afterAll(async () => {
  await teardownTestDB();
});

beforeEach(async () => {
  await clearDatabase();
});

describe('Auth Endpoints - Unit & Integration Tests', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new Founder successfully with 201 and return user object without password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Jane Founder',
          email: 'jane@startup.io',
          password: 'securePassword123',
          role: 'Founder'
        });

      expect(res.status).toBe(201);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.name).toBe('Jane Founder');
      expect(res.body.user.email).toBe('jane@startup.io');
      expect(res.body.user.role).toBe('Founder');
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(res.body.user.password).toBeUndefined();

      // Verify persistence in DB
      const userInDb = await User.findOne({ email: 'jane@startup.io' });
      expect(userInDb).not.toBeNull();
      expect(userInDb.passwordHash).toBeDefined();
      expect(userInDb.passwordHash).not.toBe('securePassword123');
    });

    it('should register a new Investor successfully with 201', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Bob Investor',
          email: 'bob@venture.com',
          password: 'securePassword123',
          role: 'Investor'
        });

      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe('Investor');
    });

    it('should return 409 when registering with an existing email (case-insensitive)', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ name: 'User One', email: 'duplicate@test.com', password: 'password123', role: 'Founder' });

      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'User Two', email: 'DUPLICATE@TEST.COM', password: 'password123', role: 'Investor' });

      expect(res.status).toBe(409);
      expect(res.body.field).toBe('email');
    });

    it('should return 400 when name is missing or whitespace', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: '   ', email: 'valid@test.com', password: 'password123', role: 'Founder' });
      expect(res.status).toBe(400);
      expect(res.body.field).toBe('name');
    });

    it('should return 400 when name exceeds 100 characters', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'a'.repeat(101), email: 'valid@test.com', password: 'password123', role: 'Founder' });
      expect(res.status).toBe(400);
      expect(res.body.field).toBe('name');
    });

    it('should return 400 when email is invalid', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Test User', email: 'invalid-email', password: 'password123', role: 'Founder' });
      expect(res.status).toBe(400);
      expect(res.body.field).toBe('email');
    });

    it('should return 400 when password is fewer than 8 characters', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Test User', email: 'valid@test.com', password: 'short', role: 'Founder' });
      expect(res.status).toBe(400);
      expect(res.body.field).toBe('password');
    });

    it('should return 400 when password exceeds 128 characters', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Test User', email: 'valid@test.com', password: 'a'.repeat(129), role: 'Founder' });
      expect(res.status).toBe(400);
      expect(res.body.field).toBe('password');
    });

    it('should return 400 when role is invalid', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Test User', email: 'valid@test.com', password: 'password123', role: 'Admin' });
      expect(res.status).toBe(400);
      expect(res.body.field).toBe('role');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ name: 'Existing User', email: 'login@test.com', password: 'correctPassword123', role: 'Founder' });
    });

    it('should login successfully with valid credentials and return 200', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'login@test.com', password: 'correctPassword123' });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('login@test.com');
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('should return 401 when password is incorrect', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'login@test.com', password: 'wrongPassword' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password');
    });

    it('should return 401 when email does not exist', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@test.com', password: 'correctPassword123' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password');
    });

    it('should lock account after 5 consecutive failed login attempts and return 423', async () => {
      for (let i = 0; i < 4; i++) {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ email: 'login@test.com', password: 'wrongPassword' });
        expect(res.status).toBe(401);
      }

      // 5th attempt triggers lockout
      const fifthRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'login@test.com', password: 'wrongPassword' });
      expect(fifthRes.status).toBe(401);

      // Next attempt (even with correct password) returns 423
      const lockedRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'login@test.com', password: 'correctPassword123' });
      expect(lockedRes.status).toBe(423);
      expect(lockedRes.body.error).toContain('locked');
    });
  });

  describe('POST /api/auth/logout and GET /api/auth/me', () => {
    it('should logout and invalidate session', async () => {
      const agent = request.agent(app);
      const regRes = await agent
        .post('/api/auth/register')
        .send({ name: 'Me User', email: 'me@test.com', password: 'password123', role: 'Founder' });
      expect(regRes.status).toBe(201);

      // Verify me works
      const meRes = await agent.get('/api/auth/me');
      expect(meRes.status).toBe(200);
      expect(meRes.body.user.email).toBe('me@test.com');

      // Logout
      const logoutRes = await agent.post('/api/auth/logout');
      expect(logoutRes.status).toBe(200);

      // Subsequent /api/auth/me returns 401
      const meAfterLogout = await agent.get('/api/auth/me');
      expect(meAfterLogout.status).toBe(401);
    });

    it('should return 401 for GET /api/auth/me when unauthenticated', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });
  });

  // Property-Based Tests
  describe('Property-Based Tests for Auth', () => {
    // Feature: venture-lens, Property 3: Email validation rejects structurally invalid addresses
    it('Property 3: Email validation rejects structurally invalid addresses (100 runs)', async () => {
      const invalidEmailGen = fc.string().filter(s => {
        const atCount = (s.match(/@/g) || []).length;
        if (atCount !== 1) return true;
        const [local, domain] = s.split('@');
        return !local || !domain || !domain.includes('.') || domain.startsWith('.') || domain.endsWith('.') || s.includes(' ');
      });

      await fc.assert(
        fc.asyncProperty(invalidEmailGen, async (invalidEmail) => {
          const res = await request(app)
            .post('/api/auth/register')
            .send({
              name: 'Property Test User',
              email: invalidEmail,
              password: 'validPassword123',
              role: 'Founder'
            });

          expect(res.status).toBe(400);
          expect(res.body.field).toBe('email');
        }),
        { numRuns: 100 }
      );
    });

    // Feature: venture-lens, Property 4: Password length bounds are enforced universally
    it('Property 4: Password length bounds (<8 or >128) are enforced universally (100 runs)', async () => {
      const shortPasswordGen = fc.string({ maxLength: 7 });
      const longPasswordGen = fc.string({ minLength: 129, maxLength: 200 });

      await fc.assert(
        fc.asyncProperty(shortPasswordGen, async (shortPass) => {
          const res = await request(app)
            .post('/api/auth/register')
            .send({
              name: 'Short Pass User',
              email: 'short_' + Math.random().toString(36).substring(7) + '@test.com',
              password: shortPass,
              role: 'Founder'
            });

          expect(res.status).toBe(400);
          expect(res.body.field).toBe('password');
        }),
        { numRuns: 100 }
      );

      await fc.assert(
        fc.asyncProperty(longPasswordGen, async (longPass) => {
          const res = await request(app)
            .post('/api/auth/register')
            .send({
              name: 'Long Pass User',
              email: 'long_' + Math.random().toString(36).substring(7) + '@test.com',
              password: longPass,
              role: 'Founder'
            });

          expect(res.status).toBe(400);
          expect(res.body.field).toBe('password');
        }),
        { numRuns: 100 }
      );
    });
  });
});
