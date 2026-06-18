// __tests__/fraudDetectionService.test.js
"use strict";

const { checkFraud } = require("../services/fraudDetectionService");
const FraudLog = require("../models/FraudLog");

// Mock FraudLog
jest.mock("../models/FraudLog");

describe("fraudDetectionService.checkFraud", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("allows normal transaction with low risk factors", async () => {
    const transaction = {
      userId: "u1",
      tenantId: "t1",
      id: "tx1",
      amount: 1000,
      isNewDevice: false,
      quickRepeat: false,
      userPatternDeviation: 0.1,
    };

    FraudLog.create.mockResolvedValue(transaction);

    const result = await checkFraud(transaction);

    expect(result.score).toBeLessThanOrEqual(0.5);
    expect(result.decision).toBe("ALLOW");
    expect(FraudLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ decision: "ALLOW" })
    );
  });

  test("flags REVIEW when moderate risk factors present", async () => {
    const transaction = {
      userId: "u2",
      tenantId: "t2",
      id: "tx2",
      amount: 6000000, // triggers rule
      isNewDevice: true, // triggers rule
      quickRepeat: false,
      userPatternDeviation: 0.2,
    };

    FraudLog.create.mockResolvedValue(transaction);

    const result = await checkFraud(transaction);

    expect(result.score).toBeGreaterThan(0.5);
    expect(result.score).toBeLessThanOrEqual(0.8);
    expect(result.decision).toBe("REVIEW");
    expect(FraudLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ decision: "REVIEW" })
    );
  });

  test("blocks transaction when high risk factors present", async () => {
    const transaction = {
      userId: "u3",
      tenantId: "t3",
      id: "tx3",
      amount: 7000000, // triggers rule
      isNewDevice: true, // triggers rule
      quickRepeat: true, // triggers rule
      userPatternDeviation: 0.9, // triggers AI simulation
    };

    FraudLog.create.mockResolvedValue(transaction);

    const result = await checkFraud(transaction);

    expect(result.score).toBeGreaterThan(0.8);
    expect(result.decision).toBe("BLOCK");
    expect(FraudLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ decision: "BLOCK" })
    );
  });
});
