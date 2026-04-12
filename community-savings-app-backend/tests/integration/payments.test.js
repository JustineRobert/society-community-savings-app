/**
 * Payment Tests
 * ============================================================================
 * Integration tests for payment endpoints and payment provider adapters
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');

describe('Payments (POST /api/payments)', () => {
  let userToken;
  let userId;
  let groupId;

  beforeAll(async () => {
    // Ensure MongoDB connection
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost/test');
    }

    // Register and login a user
    const userData = {
      email: `payment-test-${Date.now()}@example.com`,
      password: 'SecurePassword123!',
      fullName: 'Payment Test User',
      phoneNumber: '+254712345678'
    };

    const registerRes = await request(app)
      .post('/api/auth/register')
      .send(userData);

    userToken = registerRes.body.token;
    userId = registerRes.body.user._id;
  });

  describe('POST /api/payments/initiate', () => {
    it('should initiate mobile money payment (M-Pesa)', (done) => {
      const paymentData = {
        phone: '+254712345678',
        amount: 100,
        description: 'Contribution Payment',
        provider: 'mpesa',
        groupId
      };

      request(app)
        .post('/api/payments/initiate')
        .set('Authorization', `Bearer ${userToken}`)
        .send(paymentData)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);

          expect(res.body).toHaveProperty('transactionId');
          expect(res.body).toHaveProperty('status');
          expect(res.body.status).toMatch(/pending|initiated/i);
          done();
        });
    });

    it('should initiate Stripe payment', (done) => {
      const paymentData = {
        amount: 100,
        currency: 'USD',
        description: 'Contribution Payment',
        provider: 'stripe'
      };

      request(app)
        .post('/api/payments/initiate')
        .set('Authorization', `Bearer ${userToken}`)
        .send(paymentData)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);

          expect(res.body).toHaveProperty('clientSecret');
          expect(res.body).toHaveProperty('paymentIntentId');
          done();
        });
    });

    it('should fail with missing required fields', (done) => {
      const paymentData = {
        // missing amount
        provider: 'mpesa'
      };

      request(app)
        .post('/api/payments/initiate')
        .set('Authorization', `Bearer ${userToken}`)
        .send(paymentData)
        .expect(400)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).toHaveProperty('message');
          done();
        });
    });

    it('should fail with invalid provider', (done) => {
      const paymentData = {
        phone: '+254712345678',
        amount: 100,
        provider: 'invalid-provider'
      };

      request(app)
        .post('/api/payments/initiate')
        .set('Authorization', `Bearer ${userToken}`)
        .send(paymentData)
        .expect(400)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.message).toMatch(/provider|supported/i);
          done();
        });
    });

    it('should fail with invalid amount', (done) => {
      const paymentData = {
        phone: '+254712345678',
        amount: -100, // negative amount
        provider: 'mpesa'
      };

      request(app)
        .post('/api/payments/initiate')
        .set('Authorization', `Bearer ${userToken}`)
        .send(paymentData)
        .expect(400)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.message).toMatch(/amount|valid/i);
          done();
        });
    });

    it('should require authentication', (done) => {
      const paymentData = {
        phone: '+254712345678',
        amount: 100,
        provider: 'mpesa'
      };

      request(app)
        .post('/api/payments/initiate')
        .send(paymentData)
        .expect(401)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.message).toMatch(/unauthorized|token/i);
          done();
        });
    });
  });

  describe('POST /api/payments/confirm/:transactionId', () => {
    let transactionId;

    beforeAll(async () => {
      // Initiate a payment first
      const paymentData = {
        phone: '+254712345678',
        amount: 100,
        description: 'Test Payment',
        provider: 'mpesa'
      };

      const res = await request(app)
        .post('/api/payments/initiate')
        .set('Authorization', `Bearer ${userToken}`)
        .send(paymentData);

      transactionId = res.body.transactionId;
    });

    it('should confirm payment with valid transaction ID', (done) => {
      request(app)
        .post(`/api/payments/confirm/${transactionId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);

          expect(res.body).toHaveProperty('status');
          done();
        });
    });

    it('should fail with invalid transaction ID', (done) => {
      request(app)
        .post('/api/payments/confirm/invalid-id')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404)
        .end((err, res) => {
          if (err) return done(err);
          done();
        });
    });
  });

  describe('GET /api/payments/history', () => {
    it('should fetch payment history', (done) => {
      request(app)
        .get('/api/payments/history')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);

          expect(res.body).toHaveProperty('payments');
          expect(Array.isArray(res.body.payments)).toBe(true);
          done();
        });
    });

    it('should support pagination', (done) => {
      request(app)
        .get('/api/payments/history?page=1&limit=10')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);

          expect(res.body).toHaveProperty('payments');
          expect(res.body).toHaveProperty('pagination');
          done();
        });
    });

    it('should require authentication', (done) => {
      request(app)
        .get('/api/payments/history')
        .expect(401)
        .end((err, res) => {
          if (err) return done(err);
          done();
        });
    });
  });

  describe('GET /api/payments/:transactionId', () => {
    let transactionId;

    beforeAll(async () => {
      const paymentData = {
        phone: '+254712345678',
        amount: 100,
        provider: 'mpesa'
      };

      const res = await request(app)
        .post('/api/payments/initiate')
        .set('Authorization', `Bearer ${userToken}`)
        .send(paymentData);

      transactionId = res.body.transactionId;
    });

    it('should fetch payment details', (done) => {
      request(app)
        .get(`/api/payments/${transactionId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);

          expect(res.body).toHaveProperty('transactionId');
          expect(res.body).toHaveProperty('amount');
          expect(res.body).toHaveProperty('status');
          done();
        });
    });

    it('should return 404 for non-existent transaction', (done) => {
      request(app)
        .get('/api/payments/non-existent-id')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404)
        .end((err, res) => {
          if (err) return done(err);
          done();
        });
    });
  });

  describe('Payment Webhook', () => {
    it('should handle M-Pesa callback', (done) => {
      const webhookData = {
        Body: {
          stkCallback: {
            MerchantRequestID: 'test-request-id',
            CheckoutRequestID: 'test-checkout-id',
            ResultCode: 0,
            ResultDesc: 'The service request has been processed successfully.',
            CallbackMetadata: {
              Item: [
                { Name: 'Amount', Value: 100 },
                { Name: 'MpesaReceiptNumber', Value: 'test-receipt' },
                { Name: 'PhoneNumber', Value: '+254712345678' }
              ]
            }
          }
        }
      };

      request(app)
        .post('/api/payments/webhook/mpesa')
        .send(webhookData)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).toHaveProperty('ResultCode', 0);
          done();
        });
    });

    it('should handle Stripe webhook', (done) => {
      const webhookData = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test123',
            status: 'succeeded',
            amount: 10000
          }
        }
      };

      request(app)
        .post('/api/payments/webhook/stripe')
        .send(webhookData)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          done();
        });
    });
  });
});

module.exports = {};
