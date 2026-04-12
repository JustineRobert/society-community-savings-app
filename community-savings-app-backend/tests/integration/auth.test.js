/**
 * Authentication Tests
 * ============================================================================
 * Unit and integration tests for authentication endpoints and JWT handling
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const app = require('../../server');

describe('Authentication (POST /api/auth)', () => {
  let testUser;

  beforeAll(async () => {
    // Ensure MongoDB connection
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost/test');
    }
  });

  afterAll(async () => {
    // Uncomment if you want to disconnect after tests
    // await mongoose.connection.close();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', (done) => {
      const userData = {
        email: `test-${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        fullName: 'Test User',
        phoneNumber: '+254712345678'
      };

      request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201)
        .end((err, res) => {
          if (err) return done(err);

          expect(res.body).toHaveProperty('token');
          expect(res.body).toHaveProperty('user');
          expect(res.body.user.email).toBe(userData.email);
          testUser = res.body.user;
          done();
        });
    });

    it('should fail registration with duplicate email', (done) => {
      const userData = {
        email: testUser.email,
        password: 'AnotherPassword123!',
        fullName: 'Duplicate User',
        phoneNumber: '+254712345679'
      };

      request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).toHaveProperty('message');
          expect(res.body.message).toMatch(/already registered|duplicate/i);
          done();
        });
    });

    it('should fail registration with weak password', (done) => {
      const userData = {
        email: `weak-${Date.now()}@example.com`,
        password: '123', // too weak
        fullName: 'Weak User',
        phoneNumber: '+254712345680'
      };

      request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.message).toMatch(/password|weak/i);
          done();
        });
    });

    it('should fail registration with missing required fields', (done) => {
      const userData = {
        email: `missing-${Date.now()}@example.com',
        // missing password
        fullName: 'Missing Field User'
      };

      request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).toHaveProperty('message');
          done();
        });
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', (done) => {
      const loginData = {
        email: testUser.email,
        password: 'SecurePassword123!'
      };

      request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);

          expect(res.body).toHaveProperty('token');
          expect(res.body).toHaveProperty('user');
          expect(res.body.token).toBeTruthy();

          // Verify JWT structure
          const decoded = jwt.decode(res.body.token);
          expect(decoded).toHaveProperty('userId');
          done();
        });
    });

    it('should fail login with incorrect password', (done) => {
      const loginData = {
        email: testUser.email,
        password: 'WrongPassword123!'
      };

      request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.message).toMatch(/invalid|incorrect|credentials/i);
          done();
        });
    });

    it('should fail login with non-existent email', (done) => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'SomePassword123!'
      };

      request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.message).toMatch(/not found|invalid|credentials/i);
          done();
        });
    });
  });

  describe('POST /api/auth/refresh-token', () => {
    let validToken;

    beforeAll(async () => {
      // Login to get a token
      const loginData = {
        email: testUser.email,
        password: 'SecurePassword123!'
      };

      const res = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      validToken = res.body.token;
    });

    it('should refresh token with valid token', (done) => {
      request(app)
        .post('/api/auth/refresh-token')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);

          expect(res.body).toHaveProperty('token');
          expect(res.body.token).not.toBe(validToken); // Should be a new token
          done();
        });
    });

    it('should fail refresh with missing token', (done) => {
      request(app)
        .post('/api/auth/refresh-token')
        .expect(401)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.message).toMatch(/token|unauthorized/i);
          done();
        });
    });

    it('should fail refresh with invalid token', (done) => {
      request(app)
        .post('/api/auth/refresh-token')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.message).toMatch(/invalid|token/i);
          done();
        });
    });
  });

  describe('POST /api/auth/logout', () => {
    let validToken;

    beforeAll(async () => {
      const loginData = {
        email: testUser.email,
        password: 'SecurePassword123!'
      };

      const res = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      validToken = res.body.token;
    });

    it('should logout successfully', (done) => {
      request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).toHaveProperty('message');
          done();
        });
    });

    it('should fail logout without token', (done) => {
      request(app)
        .post('/api/auth/logout')
        .expect(401)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.message).toMatch(/token|unauthorized/i);
          done();
        });
    });
  });

  describe('Password Reset Flow', () => {
    it('should request password reset', (done) => {
      request(app)
        .post('/api/auth/forgot-password')
        .send({ email: testUser.email })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.message).toMatch(/email sent|check your email/i);
          done();
        });
    });

    it('should fail reset request for non-existent email', (done) => {
      request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(404)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.message).toMatch(/not found/i);
          done();
        });
    });
  });
});

module.exports = {};
