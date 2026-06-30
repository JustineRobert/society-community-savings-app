// ============================================================================
// TITech Community Capital
// File: backend/controllers/ussdController.js
// Production Grade USSD Controller
// Multi-Tenant | MoMo | Savings | Loans | Enterprise Ready
// ============================================================================

"use strict";

const crypto = require("crypto");

const logger = require("../utils/logger");
const metricsService = require("../services/metricsService");
const auditService = require("../services/auditService");
const ussdSessionService = require("../services/ussdSessionService");
const tenantService = require("../services/tenantService");
const memberService = require("../services/memberService");
const savingsService = require("../services/savingsService");
const loanService = require("../services/loanService");
const mobileMoneyService = require("../services/mobileMoneyService");
const notificationService = require("../services/notificationService");
const featureFlagService = require("../services/featureFlagService");

class USSDController {
  // ===========================================================================
  // Entry Point
  // ===========================================================================

  async handle(payloadOrReq, res = null) {
    const startedAt = Date.now();

    try {
      const ctx = this.normalizeRequest(
        payloadOrReq,
        res
      );

      logger.info(
        "USSD request received",
        {
          tenantId: ctx.tenant?.id,
          sessionId: ctx.sessionId,
          phoneNumber: ctx.phoneNumber,
          text: ctx.text,
          correlationId:
            ctx.correlationId,
        }
      );

      metricsService.increment(
        "ussd.request.received"
      );

      const session =
        await this.loadSession(ctx);

      const response =
        await this.routeRequest(
          ctx,
          session
        );

      await this.persistSession(
        ctx,
        session
      );

      metricsService.timing(
        "ussd.request.duration",
        Date.now() - startedAt
      );

      return response;
    } catch (error) {
      logger.error(
        "USSD processing failed",
        {
          error: error.message,
          stack: error.stack,
        }
      );

      metricsService.increment(
        "ussd.request.error"
      );

      return this.end(
        "Service temporarily unavailable."
      );
    }
  }

  // ===========================================================================
  // Context Normalization
  // ===========================================================================

  normalizeRequest(
    payloadOrReq,
    res
  ) {
    if (
      payloadOrReq &&
      payloadOrReq.body
    ) {
      const req = payloadOrReq;

      return {
        tenant: req.tenant,
        sessionId:
          req.body.sessionId,
        serviceCode:
          req.body.serviceCode,
        phoneNumber:
          req.body.phoneNumber,
        text:
          req.body.text || "",
        correlationId:
          req.correlationId,
        requestId:
          req.requestId,
        req,
        res,
      };
    }

    return payloadOrReq;
  }

  // ===========================================================================
  // Session
  // ===========================================================================

  async loadSession(ctx) {
    let session =
      await ussdSessionService.findSession(
        ctx.sessionId
      );

    if (session) {
      return session;
    }

    session = {
      id: crypto.randomUUID(),
      sessionId: ctx.sessionId,
      tenantId:
        ctx.tenant?.id,
      phoneNumber:
        ctx.phoneNumber,
      currentMenu: "MAIN",
      metadata: {},
      createdAt:
        new Date(),
    };

    await ussdSessionService.createSession(
      session
    );

    return session;
  }

  async persistSession(
    ctx,
    session
  ) {
    try {
      await ussdSessionService.updateSession(
        ctx.sessionId,
        session
      );
    } catch (error) {
      logger.error(
        "Failed to persist session",
        {
          error: error.message,
          sessionId:
            ctx.sessionId,
        }
      );
    }
  }

  // ===========================================================================
  // Router
  // ===========================================================================

  async routeRequest(
    ctx,
    session
  ) {
    const text =
      ctx.text.trim();

    if (!text) {
      return this.mainMenu();
    }

    const args =
      text.split("*");

    const option =
      args[0];

    switch (option) {
      case "1":
        return this.handleSavings(
          ctx,
          session,
          args
        );

      case "2":
        return this.handleLoans(
          ctx,
          session,
          args
        );

      case "3":
        return this.handleBalance(
          ctx,
          session
        );

      case "4":
        return this.handleMemberProfile(
          ctx,
          session
        );

      case "5":
        return this.handleMobileMoney(
          ctx,
          session,
          args
        );

      case "6":
        return this.handleHelp();

      default:
        return this.end(
          "Invalid selection."
        );
    }
  }

  // ===========================================================================
  // Main Menu
  // ===========================================================================

  mainMenu() {
    return this.continue(`
Welcome to TITech Community Capital

1. Savings
2. Loans
3. Balance
4. My Profile
5. Mobile Money
6. Help
`);
  }

  // ===========================================================================
  // Savings
  // ===========================================================================

  async handleSavings(
    ctx,
    session,
    args
  ) {
    if (args.length === 1) {
      return this.continue(`
Savings

1. Deposit
2. Statement
3. Savings Balance
`);
    }

    const action = args[1];

    switch (action) {
      case "1":
        return this.handleDeposit(
          ctx,
          session,
          args
        );

      case "2":
        return this.handleStatement(
          ctx
        );

      case "3":
        return this.handleSavingsBalance(
          ctx
        );

      default:
        return this.end(
          "Invalid option."
        );
    }
  }

  // ===========================================================================
  // Deposit
  // ===========================================================================

  async handleDeposit(
    ctx,
    session,
    args
  ) {
    if (args.length < 3) {
      return this.continue(
        "Enter amount:"
      );
    }

    const amount =
      Number(args[2]);

    if (
      Number.isNaN(amount) ||
      amount <= 0
    ) {
      return this.end(
        "Invalid amount."
      );
    }

    await mobileMoneyService.initiateCollection(
      {
        tenantId:
          ctx.tenant.id,
        phoneNumber:
          ctx.phoneNumber,
        amount,
        channel: "USSD",
      }
    );

    await auditService.log({
      action:
        "USSD_DEPOSIT_REQUESTED",
      tenantId:
        ctx.tenant.id,
      phoneNumber:
        ctx.phoneNumber,
      amount,
    });

    return this.end(
      `A mobile money prompt has been sent for UGX ${amount}.`
    );
  }

  // ===========================================================================
  // Loans
  // ===========================================================================

  async handleLoans(
    ctx,
    session,
    args
  ) {
    if (args.length === 1) {
      return this.continue(`
Loans

1. Apply
2. Loan Balance
3. Repayment
`);
    }

    switch (args[1]) {
      case "1":
        return this.handleLoanApplication(
          ctx,
          args
        );

      case "2":
        return this.handleLoanBalance(
          ctx
        );

      case "3":
        return this.handleLoanRepayment(
          ctx,
          args
        );

      default:
        return this.end(
          "Invalid selection."
        );
    }
  }

  async handleLoanApplication(
    ctx,
    args
  ) {
    if (args.length < 3) {
      return this.continue(
        "Enter loan amount:"
      );
    }

    const amount =
      Number(args[2]);

    const application =
      await loanService.createUSSDApplication(
        {
          tenantId:
            ctx.tenant.id,
          phoneNumber:
            ctx.phoneNumber,
          amount,
        }
      );

    return this.end(
      `Loan application submitted. Reference: ${application.reference}.`
    );
  }

  async handleLoanBalance(ctx) {
    const balance =
      await loanService.getLoanBalance(
        ctx.tenant.id,
        ctx.phoneNumber
      );

    return this.end(
      `Outstanding loan balance is UGX ${balance}.`
    );
  }

  async handleLoanRepayment(
    ctx,
    args
  ) {
    if (args.length < 3) {
      return this.continue(
        "Enter repayment amount:"
      );
    }

    const amount =
      Number(args[2]);

    await mobileMoneyService.initiateCollection(
      {
        tenantId:
          ctx.tenant.id,
        phoneNumber:
          ctx.phoneNumber,
        amount,
        purpose:
          "LOAN_REPAYMENT",
      }
    );

    return this.end(
      `Repayment request for UGX ${amount} has been initiated.`
    );
  }

  // ===========================================================================
  // Balance
  // ===========================================================================

  async handleBalance(ctx) {
    const balance =
      await savingsService.getMemberBalance(
        ctx.tenant.id,
        ctx.phoneNumber
      );

    return this.end(
      `Your balance is UGX ${balance}.`
    );
  }

  async handleSavingsBalance(
    ctx
  ) {
    const balance =
      await savingsService.getMemberBalance(
        ctx.tenant.id,
        ctx.phoneNumber
      );

    return this.end(
      `Savings balance: UGX ${balance}`
    );
  }

  // ===========================================================================
  // Statement
  // ===========================================================================

  async handleStatement(ctx) {
    await notificationService.sendSMS(
      {
        tenantId:
          ctx.tenant.id,
        phoneNumber:
          ctx.phoneNumber,
        message:
          "Your statement will be sent shortly.",
      }
    );

    return this.end(
      "Statement request received."
    );
  }

  // ===========================================================================
  // Member Profile
  // ===========================================================================

  async handleMemberProfile(
    ctx
  ) {
    const member =
      await memberService.findByPhone(
        ctx.tenant.id,
        ctx.phoneNumber
      );

    if (!member) {
      return this.end(
        "Member account not found."
      );
    }

    return this.end(
      `
Name: ${member.fullName}
Member No: ${member.memberNumber}
Status: ${member.status}
`
    );
  }

  // ===========================================================================
  // Mobile Money
  // ===========================================================================

  async handleMobileMoney(
    ctx,
    session,
    args
  ) {
    const enabled =
      await featureFlagService.isEnabled(
        "mobile_money",
        ctx.tenant.id
      );

    if (!enabled) {
      return this.end(
        "Mobile money service is unavailable."
      );
    }

    return this.end(
      "Mobile Money services are active."
    );
  }

  // ===========================================================================
  // Help
  // ===========================================================================

  async handleHelp() {
    return this.end(
      `
For assistance:

Call: +256 394 324 760
Email: support@titechcommunitycapital.com
`
    );
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  continue(message) {
    return `CON ${message.trim()}`;
  }

  end(message) {
    return `END ${message.trim()}`;
  }
}

module.exports =
  new USSDController();