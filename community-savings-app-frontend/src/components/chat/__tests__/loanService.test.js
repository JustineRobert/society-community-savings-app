// __tests__/loanService.test.js
"use strict";

const loanService = require("../services/loanService");
const Loan = require("../models/Loan");
const walletService = require("../services/walletService");
const redis = require("../utils/redis");
const LoanWorkflowService = require("../services/LoanWorkflowService");

// 🔹 Mock dependencies
jest.mock("../models/Loan");
jest.mock("../services/walletService");
jest.mock("../utils/redis");
jest.mock("../services/LoanWorkflowService");

describe("loanService.processLoan", () => {
  let workflowMock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock workflow methods
    workflowMock = {
      createLoanApplication: jest.fn().mockResolvedValue({ _id: "loan123", status: "pending_application" }),
      changeLoanStatus: jest.fn().mockResolvedValue(true),
    };
    LoanWorkflowService.mockImplementation(() => workflowMock);

    // Mock wallet credit
    walletService.creditWallet.mockResolvedValue(true);

    // Mock Loan.create
    Loan.create.mockResolvedValue({ _id: "loan123", userId: "user1", tenantId: "tenant1", amount: 1000 });
  });

  test("rejects loan when credit score < 400", async () => {
    redis.get.mockResolvedValue("350");

    const result = await loanService.processLoan("user1", "tenant1", 1000);

    expect(result.status).toBe("REJECTED");
    expect(result.reason).toMatch(/Credit score below threshold/);
    expect(workflowMock.createLoanApplication).not.toHaveBeenCalled();
    expect(walletService.creditWallet).not.toHaveBeenCalled();
  });

  test("marks loan as pending review when credit score between 400 and 650", async () => {
    redis.get.mockResolvedValue("600");

    const result = await loanService.processLoan("user1", "tenant1", 1000);

    expect(result.status).toBe("PENDING_REVIEW");
    expect(result.reason).toMatch(/Requires manual approval/);
    expect(workflowMock.createLoanApplication).not.toHaveBeenCalled();
    expect(walletService.creditWallet).not.toHaveBeenCalled();
  });

  test("auto-approves and disburses loan when credit score > 650", async () => {
    redis.get.mockResolvedValue("700");

    const loan = await loanService.processLoan("user1", "tenant1", 1000, "Test loan", "Education");

    expect(workflowMock.createLoanApplication).toHaveBeenCalledWith(
      expect.objectContaining({ borrowerId: "user1", groupId: "tenant1", amount: 1000 })
    );
    expect(workflowMock.changeLoanStatus).toHaveBeenCalledWith(
      "loan123",
      "approved",
      expect.any(Object),
      expect.stringContaining("Auto-approved")
    );
    expect(workflowMock.changeLoanStatus).toHaveBeenCalledWith(
      "loan123",
      "disbursed",
      expect.any(Object),
      expect.stringContaining("Funds disbursed")
    );
    expect(walletService.creditWallet).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user1", tenantId: "tenant1", amount: 1000 })
    );
    expect(loan._id).toBe("loan123");
  });

  test("throws error if no credit score found", async () => {
    redis.get.mockResolvedValue(null);

    await expect(loanService.processLoan("user1", "tenant1", 1000)).rejects.toThrow("No credit score available");
  });
});
