/**
 * ============================================================
 * TITech Community Capital LTD
 * Enterprise SACCO Onboarding Controller
 * ============================================================
 */

const httpStatus = require("http-status");
const OnboardingService = require("./onboarding.service");

const {
  successResponse
} = require("../../shared/utils/apiResponse");

const AuditService = require("../../audit/audit.service");
const logger = require("../../shared/logger");

/**
 * ============================================================
 * Register SACCO
 * ============================================================
 */
exports.registerSacco = async (req, res, next) => {
  try {
    const correlationId = req.headers["x-correlation-id"];

    const payload = {
      ...req.body,
      createdBy: req.user?.id,
      tenantId: req.tenantId || null
    };

    const sacco =
      await OnboardingService.registerSacco(payload);

    await AuditService.log({
      tenantId: sacco.tenantId,
      userId: req.user?.id,
      entity: "SACCO",
      entityId: sacco._id,
      action: "SACCO_REGISTERED",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    logger.info(
      `SACCO Registered: ${sacco.saccoName}`,
      {
        correlationId,
        saccoId: sacco._id
      }
    );

    return res.status(httpStatus.CREATED).json(
      successResponse(
        "SACCO registered successfully",
        sacco
      )
    );

  } catch (error) {
    logger.error(
      "Failed to register SACCO",
      {
        error: error.message
      }
    );

    next(error);
  }
};

/**
 * ============================================================
 * Get SACCO By ID
 * ============================================================
 */
exports.getSaccoById = async (
  req,
  res,
  next
) => {
  try {

    const sacco =
      await OnboardingService.getSaccoById(
        req.params.id
      );

    return res.status(httpStatus.OK).json(
      successResponse(
        "SACCO retrieved successfully",
        sacco
      )
    );

  } catch (error) {
    next(error);
  }
};

/**
 * ============================================================
 * List SACCOs
 * ============================================================
 */
exports.getAllSaccos = async (
  req,
  res,
  next
) => {
  try {

    const result =
      await OnboardingService.getAllSaccos({
        page: req.query.page || 1,
        limit: req.query.limit || 20,
        search: req.query.search,
        status: req.query.status,
        tenantId: req.tenantId
      });

    return res.status(httpStatus.OK).json(
      successResponse(
        "SACCOs retrieved successfully",
        result
      )
    );

  } catch (error) {
    next(error);
  }
};

/**
 * ============================================================
 * Verify KYC
 * ============================================================
 */
exports.verifyKYC = async (
  req,
  res,
  next
) => {
  try {

    const sacco =
      await OnboardingService.verifyKYC(
        req.params.id,
        req.body,
        req.user
      );

    await AuditService.log({
      tenantId: sacco.tenantId,
      userId: req.user?.id,
      entity: "SACCO",
      entityId: sacco._id,
      action: "KYC_APPROVED",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    return res.status(httpStatus.OK).json(
      successResponse(
        "KYC verification completed",
        sacco
      )
    );

  } catch (error) {
    next(error);
  }
};

/**
 * ============================================================
 * Setup Subscription
 * ============================================================
 */
exports.setupSubscription = async (
  req,
  res,
  next
) => {
  try {

    const subscription =
      await OnboardingService.setupSubscription(
        req.params.id,
        req.body,
        req.user
      );

    await AuditService.log({
      tenantId: subscription.tenantId,
      userId: req.user?.id,
      entity: "SUBSCRIPTION",
      entityId: subscription._id,
      action: "SUBSCRIPTION_CREATED",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    return res.status(httpStatus.OK).json(
      successResponse(
        "Subscription configured successfully",
        subscription
      )
    );

  } catch (error) {
    next(error);
  }
};

/**
 * ============================================================
 * Go Live
 * ============================================================
 */
exports.goLive = async (
  req,
  res,
  next
) => {
  try {

    const liveSacco =
      await OnboardingService.goLive(
        req.params.id,
        req.user
      );

    await AuditService.log({
      tenantId: liveSacco.tenantId,
      userId: req.user?.id,
      entity: "SACCO",
      entityId: liveSacco._id,
      action: "SACCO_GO_LIVE",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    return res.status(httpStatus.OK).json(
      successResponse(
        "SACCO is now LIVE",
        liveSacco
      )
    );

  } catch (error) {
    next(error);
  }
};

/**
 * ============================================================
 * Get SACCO Progress
 * ============================================================
 */
exports.getOnboardingProgress = async (
  req,
  res,
  next
) => {
  try {

    const progress =
      await OnboardingService.getProgress(
        req.params.id
      );

    return res.status(httpStatus.OK).json(
      successResponse(
        "Onboarding progress retrieved",
        progress
      )
    );

  } catch (error) {
    next(error);
  }
};

/**
 * ============================================================
 * Upload KYC Documents
 * ============================================================
 */
exports.uploadDocuments = async (
  req,
  res,
  next
) => {
  try {

    const documents =
      await OnboardingService.uploadDocuments(
        req.params.id,
        req.files,
        req.user
      );

    await AuditService.log({
      tenantId: documents.tenantId,
      userId: req.user?.id,
      entity: "DOCUMENT",
      entityId: req.params.id,
      action: "DOCUMENT_UPLOADED",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    return res.status(httpStatus.OK).json(
      successResponse(
        "Documents uploaded successfully",
        documents
      )
    );

  } catch (error) {
    next(error);
  }
};

/**
 * ============================================================
 * Reject SACCO Application
 * ============================================================
 */
exports.rejectApplication = async (
  req,
  res,
  next
) => {
  try {

    const result =
      await OnboardingService.rejectApplication(
        req.params.id,
        req.body.reason,
        req.user
      );

    await AuditService.log({
      tenantId: result.tenantId,
      userId: req.user?.id,
      entity: "SACCO",
      entityId: result._id,
      action: "APPLICATION_REJECTED",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    return res.status(httpStatus.OK).json(
      successResponse(
        "Application rejected",
        result
      )
    );

  } catch (error) {
    next(error);
  }
};

/**
 * ============================================================
 * Dashboard Metrics
 * ============================================================
 */
exports.getOnboardingMetrics = async (
  req,
  res,
  next
) => {
  try {

    const metrics =
      await OnboardingService.metrics();

    return res.status(httpStatus.OK).json(
      successResponse(
        "Metrics retrieved successfully",
        metrics
      )
    );

  } catch (error) {
    next(error);
  }
};