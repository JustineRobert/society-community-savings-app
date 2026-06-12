/**
 * Contributions Tests
 * ============================================================================
 * Integration tests for contribution endpoints
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');

describe('Contributions (GET/POST /api/contributions)', () => {
  let userToken;
  let userId;
  let groupId;
  let contributionId;
  let confirmContributionId; // ✅ ADD HERE (global scope)
``

  beforeAll(async () => {
    // Ensure MongoDB connection
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost/test');
    }

    // Register and login a user
    const userData = {
      email: `contribution-test-${Date.now()}@example.com`,
      password: 'SecurePassword123!',
      fullName: 'Contribution Test User',
      phoneNumber: '+254712345678',
    };

    const registerRes = await request(app).post('/api/auth/register').send(userData);

    userToken = registerRes.body.token;
    userId = registerRes.body.user._id;

    // Create a test group
    const groupData = {
      name: `Test Group ${Date.now()}`,
      description: 'Test group for contributions',
      targetAmount: 10000,
      cycle: 'monthly',
    };

    const groupRes = await request(app)
      .post('/api/groups')
      .set('Authorization', `Bearer ${userToken}`)
      .send(groupData);

    groupId = groupRes.body.group._id;
  });

  describe('POST /api/contributions/submit', () => {
    it('should submit a contribution', (done) => {
      const contributionData = {
        groupId,
        amount: 1000,
        paymentMethod: 'mobile_money',
        phone: '+254712345678',
      };

      request(app)
        .post('/api/contributions/submit')
        .set('Authorization', `Bearer ${userToken}`)
        .send(contributionData)
        .expect(201)
        .end((err, res) => {
          if (err) return done(err);

          expect(res.body).toHaveProperty('_id');
          expect(res.body).toHaveProperty('status', 'pending');
          expect(res.body.amount).toBe(contributionData.amount);
          contributionId = res.body._id;
          done();
        });
    });

    it('should fail with missing required fields', (done) => {
      const contributionData = {
        groupId,
        // missing amount
        paymentMethod: 'mobile_money',
      };

      request(app)
        .post('/api/contributions/submit')
        .set('Authorization', `Bearer ${userToken}`)
        .send(contributionData)
        .expect(400)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).toHaveProperty('message');
          done();
        });
    });

    it('should fail with zero amount', (done) => {
      const contributionData = {
        groupId,
        amount: 0,
        paymentMethod: 'mobile_money',
      };

      request(app)
        .post('/api/contributions/submit')
        .set('Authorization', `Bearer ${userToken}`)
        .send(contributionData)
        .expect(400)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.message).toMatch(/amount|positive/i);
          done();
        });
    });

    it('should require authentication', (done) => {
      const contributionData = {
        groupId,
        amount: 1000,
      };

      request(app)
        .post('/api/contributions/submit')
        .send(contributionData)
        .expect(401)
        .end((err, res) => {
          if (err) return done(err);
          done();
        });
    });
  });

  describe('GET /api/contributions', () => {
    it('should fetch all contributions for user', (done) => {
      request(app)
        .get('/api/contributions')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);

          expect(res.body).toHaveProperty('contributions');
          expect(Array.isArray(res.body.contributions)).toBe(true);
          done();
        });
    });

    it('should support filtering by group', (done) => {
      request(app)
        .get(`/api/contributions?groupId=${groupId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);

          expect(res.body).toHaveProperty('contributions');
          if (res.body.contributions.length > 0) {
            res.body.contributions.forEach((contrib) => {
              expect(contrib.groupId).toBe(groupId);
            });
          }
          done();
        });
    });

    it('should support status filtering', (done) => {
      request(app)
        .get('/api/contributions?status=pending')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);

          expect(res.body).toHaveProperty('contributions');
          if (res.body.contributions.length > 0) {
            res.body.contributions.forEach((contrib) => {
              expect(contrib.status).toBe('pending');
            });
          }
          done();
        });
    });

    it('should support pagination', (done) => {
      request(app)
        .get('/api/contributions?page=1&limit=10')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);

          expect(res.body).toHaveProperty('contributions');
          expect(res.body).toHaveProperty('pagination');
          done();
        });
    });

    it('should support date range filtering', (done) => {
      const endDate = new Date().toISOString();
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      request(app)
        .get(`/api/contributions?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);

          expect(res.body).toHaveProperty('contributions');
          done();
        });
    });
  });

  describe('GET /api/contributions/:contributionId', () => {
    it('should fetch contribution details', (done) => {
      request(app)
        .get(`/api/contributions/${contributionId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);

          expect(res.body).toHaveProperty('_id');
          expect(res.body._id).toBe(contributionId);
          expect(res.body).toHaveProperty('amount');
          expect(res.body).toHaveProperty('status');
          done();
        });
    });

    it('should return 404 for non-existent contribution', (done) => {
      request(app)
        .get('/api/contributions/invalid-id')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404)
        .end((err, _res) => {
          if (err) return done(err);
          done();
        });
    });
  });

  describe('GET /api/contributions/group/:groupId/statistics', () => {
    it('should fetch group contribution statistics', (done) => {
      request(app)
        .get(`/api/contributions/group/${groupId}/statistics`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);

          expect(res.body).toHaveProperty('totalContributions');
          expect(res.body).toHaveProperty('averageContribution');
          expect(res.body).toHaveProperty('memberCount');
          expect(res.body).toHaveProperty('targetProgress');
          done();
        });
    });
  });

  describe('GET /api/contributions/user/:userId/statistics', () => {
    it('should fetch user contribution statistics', (done) => {
      request(app)
        .get(`/api/contributions/user/${userId}/statistics`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);

          expect(res.body).toHaveProperty('totalContributed');
          expect(res.body).toHaveProperty('groupsContributedTo');
          expect(res.body).toHaveProperty('averageContribution');
          done();
        });
    });
  });

  describe('POST /api/contributions/:contributionId/confirm', () => {
    let confirmContributionId;

    beforeAll(async () => {
      const contributionData = {
        groupId,
        amount: 500,
        paymentMethod: 'mobile_money',
        phone: '+254712345678',
      };

      const res = await request(app)
        .post('/api/contributions/submit')
        .set('Authorization', `Bearer ${userToken}`)
        .send(contributionData);

      confirmContributionId = res.body._id;
    });

    it('should confirm contribution', (done) => {
      request(app)
        .post(`/api/contributions/${confirmContributionId}/confirm`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ transactionId: 'test-tx-123' })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);

          expect(res.body).toHaveProperty('status');
          expect(['completed', 'confirmed']).toContain(res.body.status);
          done();
        });
    });
  });

  describe('POST /api/contributions/:contributionId/cancel', () => {
    let cancelContributionId;

    beforeAll(async () => {
      const contributionData = {
        groupId,
        amount: 250,
        paymentMethod: 'mobile_money',
      };

      const res = await request(app)
        .post('/api/contributions/submit')
        .set('Authorization', `Bearer ${userToken}`)
        .send(contributionData);

      cancelContributionId = res.body._id;
    });

    it('should cancel contribution', (done) => {
      request(app)
        .post(`/api/contributions/${cancelContributionId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ reason: 'Changed mind' })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);

          expect(res.body).toHaveProperty('status', 'cancelled');
          done();
        });
    });

    it('should not allow cancelling confirmed contribution', (done) => {
      const confirmData = { transactionId: 'test-tx-456' };

      request(app)
        .post(`/api/contributions/${confirmContributionId}/confirm`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(confirmData)
        .end(() => {
          request(app)
            .post(`/api/contributions/${confirmContributionId}/cancel`)
            .set('Authorization', `Bearer ${userToken}`)
            .send({ reason: 'Too late' })
            .expect(400)
            .end((err, res) => {
              if (err) return done(err);
              expect(res.body.message).toMatch(/cannot|confirmed/i);
              done();
            });
        });
    });
  });

  describe('POST /api/contributions/batch-import', () => {
    it('should import contributions from CSV', (done) => {
      const csvData = `userId,groupId,amount,date
${userId},${groupId},1000,2024-01-15
${userId},${groupId},1500,2024-02-15
${userId},${groupId},1200,2024-03-15`;

      request(app)
        .post('/api/contributions/batch-import')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ csvData })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);

          expect(res.body).toHaveProperty('imported');
          expect(res.body).toHaveProperty('failed');
          done();
        });
    });
  });
});

module.exports = {};
