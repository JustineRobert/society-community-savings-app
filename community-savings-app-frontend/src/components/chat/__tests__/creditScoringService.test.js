// __tests__/creditScoringService.test.js
"use strict";

const { calculateScore, storeScore } = require("../services/creditScoringService");
const RiskProfile = require("../models/RiskProfile");

// Mock RiskProfile
jest.mock("../models/RiskProfile");

describe("creditScoringService.calculateScore", () => {
  test("returns HIGH risk when score < 400", async () => {
    const result = await calculateScore({
      savingsConsistency: 0.1,
      repaymentHistory: 0.2,
      missedPayments: 10,
    });
    expect(result.score).toBeLessThan(400);
    expect(result.riskLevel).toBe("HIGH");
  });

  test("returns MEDIUM risk when score between 400 and 700", async () => {
    const result = await calculateScore({
      savingsConsistency: 0.5,
      repaymentHistory: 0.5,
      missedPayments: 1,
    });
    expect(result.score).toBeGreaterThanOrEqual(400);
    expect(result.score).toBeLessThanOrEqual(700);
    expect(result.riskLevel).toBe("MEDIUM");
  });

  test("returns LOW risk when score > 700", async () => {
    const result = await calculateScore({
      savingsConsistency: 0.9,
      repaymentHistory: 0.95,
      missedPayments: 0,
    });
    expect(result.score).toBeGreaterThan(700);
    expect(result.riskLevel).toBe("LOW");
  });

  test("clamps score to maximum 1000", async () => {
    const result = await calculateScore({
      savingsConsistency: 1,
      repaymentHistory: 1,
      missedPayments: 0,
    });
    expect(result.score).toBeLessThanOrEqual(1000);
  });

  test("clamps score to minimum 0", async () => {
    const result = await calculateScore({
      savingsConsistency: 0,
      repaymentHistory: 0,
      missedPayments: 100,
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});

describe("creditScoringService.storeScore", () => {
  test("calls RiskProfile.findOneAndUpdate with correct params", async () => {
    const mockDoc = { userId: "u1", tenantId: "t1", creditScore: 600, riskLevel: "MEDIUM" };
    RiskProfile.findOneAndUpdate.mockResolvedValue(mockDoc);

    const result = await storeScore({ userId: "u1", tenantId: "t1", score: 600, riskLevel: "MEDIUM" });

    expect(RiskProfile.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: "u1", tenantId: "t1" },
      { creditScore: 600, riskLevel: "MEDIUM" },
      { upsert: true, new: true }
    );
    expect(result).toEqual(mockDoc);
  });
});
