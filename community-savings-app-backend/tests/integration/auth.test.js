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
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost/test');
    }
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', (done) => {
      const userData = {
        email: `test-${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        fullName: 'Test User',
        phoneNumber: '+256782397907',
      };

      request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201)
        .end((err, res) => {
          if (err) return done(err);

          testUser = res.body.user;
          done();
        });
    });

    it('should fail registration with duplicate email', (done) => {
      request(app)
        .post('/api/auth/register')
        .send({
          email: testUser.email,
          password: 'AnotherPassword123!',
          fullName: 'Duplicate User',
          phoneNumber: '+256782397907',
        })
        .expect(400)
        .end((err, _res ) => {
          if (err) return done(err);
          done();
        });
    });

    it('should fail registration with missing fields', (done) => {
      request(app)
        .post('/api/auth/register')
        .send({
          email: `missing-${Date.now()}@example.com`,
          fullName: 'Missing User',
        })
        .expect(400)
        .end((err, _res ) => {
          if (err) return done(err);
          done();
        });
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully', (done) => {
      request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'SecurePassword123!',
        })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);

          const decoded = jwt.decode(res.body.token);
          expect(decoded).toHaveProperty('userId');
          done();
        });
    });
  });

  describe('POST /api/auth/refresh-token', () => {
    let validToken;

    beforeAll(async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: testUser.email,
        password: 'SecurePassword123!',
      });

      validToken = res.body.token;
    });

    it('should refresh token with valid token', (done) => {
      request(app)
        .post('/api/auth/refresh-token')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.token).not.toBe(validToken);
          done();
        });
    });

    it('should fail refresh with missing token', (done) => {
      request(app)
        .post('/api/auth/refresh-token')
        .expect(401)
        .end((err, _res ) => {
          if (err) return done(err);
          done();
        });
    });

    it('should fail refresh with invalid token', (done) => {
      request(app)
        .post('/api/auth/refresh-token')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401)
        .end((err, _res ) => {
          if (err) return done(err);
          done();
        });
    });
  });

  describe('POST /api/auth/logout', () => {
    let validToken;

    beforeAll(async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: testUser.email,
        password: 'SecurePassword123!',
      });

      validToken = res.body.token;
    });

    it('should logout successfully', (done) => {
      request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200)
        .end((err, _res ) => {
          if (err) return done(err);
          done();
        });
    });

    it('should fail logout without token', (done) => {
      request(app)
        .post('/api/auth/logout')
        .expect(401)
        .end((err, _res ) => {
          if (err) return done(err);
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
        .end((err, _res) => {
          if (err) return done(err);
          done();
        });
    });
  });
}); // ✅ properly closed
