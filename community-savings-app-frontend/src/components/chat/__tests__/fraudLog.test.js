// __tests__/fraudLog.test.js
"use strict";

const mongoose = require("mongoose");
const FraudLog = require("../models/FraudLog");

// Mock encryption util
jest.mock("../utils/encryption", () => ({
  encryptSensitive: jest.fn(async (obj) => ({ ...obj, encrypted: true })),
}));

describe("FraudLog schema", () => {
  beforeAll(async () => {
    await mongoose.connect("mongodb://127.0.0.1:27017/testdb", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  test("clamps fraudScore between 0 and 1", async () => {
    const log = new FraudLog({
      tenantId: "t1",
      userId: new mongoose.Types.ObjectId(),
      transactionId: new mongoose.Types.ObjectId(),
      transactionSnapshot: { foo: "bar" },
      fraudScore: 5, // invalid high
      decision: "ALLOW",
    });

    await log.save();
    expect(log.fraudScore).toBe(1);
  });

  test("throws error for invalid decision", async () => {
    const log = new FraudLog({
      tenantId: "t1",
      userId: new mongoose.Types.ObjectId(),
      transactionId: new mongoose.Types.ObjectId(),
      transactionSnapshot: { foo: "bar" },
      fraudScore: 0.5,
      decision: "INVALID",
    });

    await expect(log.save()).rejects.toThrow(/Invalid decision/);
  });

  test("encrypts transactionSnapshot if util available", async () => {
    const log = new FraudLog({
      tenantId: "t1",
      userId: new mongoose.Types.ObjectId(),
      transactionId: new mongoose.Types.ObjectId(),
      transactionSnapshot: { foo: "bar" },
      fraudScore: 0.5,
      decision: "BLOCK",
    });

    await log.save();
    expect(log.transactionSnapshot.encrypted).toBe(true);
  });

  test("markReviewed updates reviewer fields", async () => {
    const log = await FraudLog.create({
      tenantId: "t1",
      userId: new mongoose.Types.ObjectId(),
      transactionId: new mongoose.Types.ObjectId(),
      transactionSnapshot: { foo: "bar" },
      fraudScore: 0.5,
      decision: "STEP_UP",
    });

    const reviewerId = new mongoose.Types.ObjectId();
    await log.markReviewed(reviewerId, "Looks suspicious");

    expect(log.reviewed).toBe(true);
    expect(log.reviewerId.toString()).toBe(reviewerId.toString());
    expect(log.reviewNotes).toBe("Looks suspicious");
  });

  test("createLog enforces required fields", async () => {
    await expect(FraudLog.createLog({ tenantId: "t1" }))
      .rejects
      .toThrow(/Missing required field/);

    const log = await FraudLog.createLog({
      tenantId: "t1",
      userId: new mongoose.Types.ObjectId(),
      transactionId: new mongoose.Types.ObjectId(),
      transactionSnapshot: { foo: "bar" },
      fraudScore: 0.5,
      decision: "ALLOW",
    });

    expect(log._id).toBeDefined();
    expect(log.decision).toBe("ALLOW");
  });
});
