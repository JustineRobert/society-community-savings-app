const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');

describe('BizChat (POST /api/bizchat/execute)', () => {
  let testUser;
  let token;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost/test');
    }
    // Register a user
    const userData = {
      email: `biz-${Date.now()}@example.com`,
      password: 'BizPassword123!',
      fullName: 'Biz User',
      phoneNumber: '+256772000000',
    };
    const tenantId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .post('/api/auth/register')
      .set('x-tenant-id', tenantId)
      .send(userData);
    testUser = res.body.user;
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: userData.email, password: userData.password });
    token = login.body.token;
  });

  it('should execute check balance command', async () => {
    const res = await request(app)
      .post('/api/bizchat/execute')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Check my SACCO balance' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.traceId).toBeDefined();
  });
});
