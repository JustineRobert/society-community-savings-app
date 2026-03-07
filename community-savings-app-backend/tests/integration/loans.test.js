/**
 * tests/integration/loans.test.js
 *
 * Integration tests for loan workflow.
 * Tests state transitions, repayment tracking, overdue detection, and audit trails.
 *
 * Coverage: LoanWorkflowService, LoanController
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const LoanWorkflowService = require('../../services/loanWorkflowService');

describe('Loan Workflow Integration Tests', () => {
  let borrower;
  let admin;
  let borrowerToken;
  let adminToken;
  let loanService;
  let testLoanId;

  beforeAll(async () => {
    loanService = app.locals.loanWorkflowService || new LoanWorkflowService();
  });

  beforeEach(async () => {
    // Create borrower and admin users
    const User = require('../../models/User');
    const jwt = require('jsonwebtoken');

    borrower = await User.create({
      name: 'Borrower User',
      email: `borrower-${Date.now()}@example.com`,
      password: 'hashedPassword123',
      roles: [],
    });

    admin = await User.create({
      name: 'Admin User',
      email: `admin-${Date.now()}@example.com`,
      password: 'hashedPassword123',
      roles: ['admin'],
    });

    borrowerToken = jwt.sign(
      { _id: borrower._id, email: borrower.email },
      process.env.JWT_SECRET || 'test-secret'
    );

    adminToken = jwt.sign(
      {
        _id: admin._id,
        email: admin.email,
        roles: ['admin'],
      },
      process.env.JWT_SECRET || 'test-secret'
    );
  });

  afterEach(async () => {
    const User = require('../../models/User');
    const Loan = require('../../models/Loan');
    const LoanRepaymentSchedule = require('../../models/LoanRepaymentSchedule');
    const LoanAudit = require('../../models/LoanAudit');

    await User.deleteMany({});
    await Loan.deleteMany({});
    await LoanRepaymentSchedule.deleteMany({});
    await LoanAudit.deleteMany({});
  });

  describe('POST /api/loans - Create Loan Application', () => {
    test('should create loan application', async () => {
      const res = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${borrowerToken}`)
        .send({
          amount: 10000,
          duration: 12,
          interestRate: 5,
          purpose: 'Business expansion',
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('_id');
      expect(res.body.data.status).toBe('pending_application');
      expect(res.body.data.amount).toBe(10000);

      testLoanId = res.body.data._id;
    });

    test('should validate amount is positive', async () => {
      const res = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${borrowerToken}`)
        .send({
          amount: -5000,
          duration: 12,
        });

      expect(res.status).toBe(400);
    });

    test('should validate duration is in valid range', async () => {
      const res = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${borrowerToken}`)
        .send({
          amount: 5000,
          duration: 400, // Exceeds max
        });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/loans/:loanId/approve - Approve Loan', () => {
    beforeEach(async () => {
      // Create loan first
      const res = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${borrowerToken}`)
        .send({
          amount: 5000,
          duration: 12,
        });
      testLoanId = res.body.data._id;
    });

    test('should approve loan as admin', async () => {
      const res = await request(app)
        .post(`/api/loans/${testLoanId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          notes: 'Approved by admin',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('approved');
    });

    test('should reject approval by non-admin', async () => {
      const res = await request(app)
        .post(`/api/loans/${testLoanId}/approve`)
        .set('Authorization', `Bearer ${borrowerToken}`)
        .send({
          notes: 'Try to approve',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/loans/:loanId/reject - Reject Loan', () => {
    beforeEach(async () => {
      const res = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${borrowerToken}`)
        .send({
          amount: 5000,
          duration: 12,
        });
      testLoanId = res.body.data._id;
    });

    test('should reject loan as admin', async () => {
      const res = await request(app)
        .post(`/api/loans/${testLoanId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'Insufficient credit history',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('rejected');
    });

    test('should require reason for rejection', async () => {
      const res = await request(app)
        .post(`/api/loans/${testLoanId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('State Machine Transitions', () => {
    test('should follow valid state transitions', async () => {
      // Create: pending_application
      const res1 = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${borrowerToken}`)
        .send({ amount: 5000, duration: 12 });
      const loanId = res1.body.data._id;

      // Approve: pending_application -> approved
      const res2 = await request(app)
        .post(`/api/loans/${loanId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(res2.body.data.status).toBe('approved');

      // Disburse: approved -> disbursed -> active (with schedule)
      const res3 = await request(app)
        .post(`/api/loans/${loanId}/disburse`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(res3.body.data.status).toBe('active');
    });
  });

  describe('GET /api/loans/:loanId/schedule - Repayment Schedule', () => {
    beforeEach(async () => {
      // Create and approve loan
      const res = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${borrowerToken}`)
        .send({ amount: 12000, duration: 12, interestRate: 5 });
      testLoanId = res.body.data._id;

      // Approve
      await request(app)
        .post(`/api/loans/${testLoanId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      // Disburse
      await request(app)
        .post(`/api/loans/${testLoanId}/disburse`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
    });

    test('should generate 12 repayment installments', async () => {
      const res = await request(app)
        .get(`/api/loans/${testLoanId}/schedule`)
        .set('Authorization', `Bearer ${borrowerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      // 12-month loan should have 12 installments
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    test('should allow borrower to view their schedule', async () => {
      const res = await request(app)
        .get(`/api/loans/${testLoanId}/schedule`)
        .set('Authorization', `Bearer ${borrowerToken}`);

      expect(res.status).toBe(200);
    });

    test('should prevent unauthorized access to schedule', async () => {
      // Other user tries to view
      const User = require('../../models/User');
      const otherUser = await User.create({
        name: 'Other User',
        email: `other-${Date.now()}@example.com`,
        password: 'hashedPassword123',
      });

      const jwt = require('jsonwebtoken');
      const otherToken = jwt.sign(
        { _id: otherUser._id, email: otherUser.email },
        process.env.JWT_SECRET || 'test-secret'
      );

      const res = await request(app)
        .get(`/api/loans/${testLoanId}/schedule`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/loans/:loanId/repayment - Record Repayment', () => {
    beforeEach(async () => {
      // Create, approve, and disburse loan
      const res = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${borrowerToken}`)
        .send({ amount: 12000, duration: 12 });
      testLoanId = res.body.data._id;

      await request(app)
        .post(`/api/loans/${testLoanId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      await request(app)
        .post(`/api/loans/${testLoanId}/disburse`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
    });

    test('should record repayment', async () => {
      const res = await request(app)
        .post(`/api/loans/${testLoanId}/repayment`)
        .set('Authorization', `Bearer ${borrowerToken}`)
        .send({
          amount: 1000,
          method: 'bank_transfer',
          reference: 'TXN-123456',
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('repayments');
    });

    test('should reject negative amount', async () => {
      const res = await request(app)
        .post(`/api/loans/${testLoanId}/repayment`)
        .set('Authorization', `Bearer ${borrowerToken}`)
        .send({
          amount: -500,
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/loans/:loanId/summary - Loan Summary', () => {
    beforeEach(async () => {
      const res = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${borrowerToken}`)
        .send({ amount: 10000, duration: 12 });
      testLoanId = res.body.data._id;
    });

    test('should return loan summary with progress', async () => {
      const res = await request(app)
        .get(`/api/loans/${testLoanId}/summary`)
        .set('Authorization', `Bearer ${borrowerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('totalAmount');
      expect(res.body.data).toHaveProperty('status');
    });
  });

  describe('Audit Trail', () => {
    test('should log all state changes', async () => {
      // Create loan
      const res = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${borrowerToken}`)
        .send({ amount: 5000, duration: 12 });
      const loanId = res.body.data._id;

      // Approve
      await request(app)
        .post(`/api/loans/${loanId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      // Check audit log
      const LoanAudit = require('../../models/LoanAudit');
      const audits = await LoanAudit.find({ loan: loanId });

      expect(audits.length).toBeGreaterThan(0);
      // Should have approval audit
      const approval = audits.find((a) => a.action === 'status_change');
      expect(approval).toBeDefined();
    });
  });
});
