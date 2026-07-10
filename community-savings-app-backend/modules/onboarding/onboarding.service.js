/**
 * ============================================================
 * TITech Community Capital LTD
 * Enterprise SACCO Onboarding Service
 * ============================================================
 */

const mongoose = require("mongoose");

const Sacco = require("./onboarding.model");

const {
  NotFoundError,
  BadRequestError
} = require("../../shared/errors");

const ONBOARDING_STATUS = {
  DRAFT: "DRAFT",
  VERIFICATION: "VERIFICATION",
  KYC_APPROVED: "KYC_APPROVED",
  SUBSCRIPTION: "SUBSCRIPTION",
  LIVE: "LIVE",
  REJECTED: "REJECTED"
};

/**
 * ============================================================
 * Register SACCO
 * ============================================================
 */
exports.registerSacco = async (payload) => {
  const existingSacco = await Sacco.findOne({
    email: payload.email
  });

  if (existingSacco) {
    throw new BadRequestError(
      "A SACCO with this email already exists"
    );
  }

  const sacco = await Sacco.create({
    ...payload,
    status: ONBOARDING_STATUS.DRAFT
  });

  return sacco;
};

/**
 * ============================================================
 * Get SACCO By ID
 * ============================================================
 */
exports.getSaccoById = async (saccoId) => {
  const sacco = await Sacco.findById(saccoId);

  if (!sacco) {
    throw new NotFoundError("SACCO not found");
  }

  return sacco;
};

/**
 * ============================================================
 * List SACCOs
 * ============================================================
 */
exports.getAllSaccos = async ({
  page = 1,
  limit = 20,
  search,
  status,
  tenantId
}) => {
  const query = {};

  if (tenantId) {
    query.tenantId = tenantId;
  }

  if (status) {
    query.status = status;
  }

  if (search) {
    query.$or = [
      {
        saccoName: {
          $regex: search,
          $options: "i"
        }
      },
      {
        email: {
          $regex: search,
          $options: "i"
        }
      }
    ];
  }

  const total =
    await Sacco.countDocuments(query);

  const items =
    await Sacco.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

  return {
    total,
    page,
    limit,
    items
  };
};

/**
 * ============================================================
 * Verify KYC
 * ============================================================
 */
exports.verifyKYC = async (
  saccoId,
  payload,
  user
) => {
  const sacco =
    await Sacco.findById(saccoId);

  if (!sacco) {
    throw new NotFoundError(
      "SACCO not found"
    );
  }

  if (
    sacco.status ===
    ONBOARDING_STATUS.LIVE
  ) {
    throw new BadRequestError(
      "SACCO already live"
    );
  }

  sacco.status =
    ONBOARDING_STATUS.KYC_APPROVED;

  sacco.kycApprovedBy =
    user?.id;

  sacco.kycApprovedAt =
    new Date();

  sacco.kycData = {
    ...(sacco.kycData || {}),
    ...payload
  };

  await sacco.save();

  return sacco;
};

/**
 * ============================================================
 * Setup Subscription
 * ============================================================
 */
exports.setupSubscription = async (
  saccoId,
  payload,
  user
) => {
  const sacco =
    await Sacco.findById(saccoId);

  if (!sacco) {
    throw new NotFoundError(
      "SACCO not found"
    );
  }

  if (
    sacco.status !==
    ONBOARDING_STATUS.KYC_APPROVED
  ) {
    throw new BadRequestError(
      "KYC must be completed first"
    );
  }

  sacco.subscription = {
    plan: payload.plan,
    billingCycle:
      payload.billingCycle,
    price: payload.price,
    currency:
      payload.currency || "UGX",
    activatedBy: user?.id,
    activatedAt: new Date()
  };

  sacco.status =
    ONBOARDING_STATUS.SUBSCRIPTION;

  await sacco.save();

  return sacco;
};

/**
 * ============================================================
 * Go Live
 * ============================================================
 */
exports.goLive = async (
  saccoId,
  user
) => {
  const session =
    await mongoose.startSession();

  session.startTransaction();

  try {
    const sacco =
      await Sacco.findById(
        saccoId
      ).session(session);

    if (!sacco) {
      throw new NotFoundError(
        "SACCO not found"
      );
    }

    if (
      sacco.status !==
      ONBOARDING_STATUS.SUBSCRIPTION
    ) {
      throw new BadRequestError(
        "Subscription setup required before go-live"
      );
    }

    sacco.status =
      ONBOARDING_STATUS.LIVE;

    sacco.liveAt =
      new Date();

    sacco.liveBy =
      user?.id;

    await sacco.save({
      session
    });

    await session.commitTransaction();
    session.endSession();

    return sacco;

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

/**
 * ============================================================
 * Upload Documents
 * ============================================================
 */
exports.uploadDocuments = async (
  saccoId,
  files,
  user
) => {
  const sacco =
    await Sacco.findById(saccoId);

  if (!sacco) {
    throw new NotFoundError(
      "SACCO not found"
    );
  }

  const documents = files.map(
    (file) => ({
      fileName: file.originalname,
      path: file.path,
      uploadedBy: user?.id,
      uploadedAt: new Date()
    })
  );

  sacco.documents = [
    ...(sacco.documents || []),
    ...documents
  ];

  await sacco.save();

  return sacco;
};

/**
 * ============================================================
 * Reject Application
 * ============================================================
 */
exports.rejectApplication = async (
  saccoId,
  reason,
  user
) => {
  const sacco =
    await Sacco.findById(saccoId);

  if (!sacco) {
    throw new NotFoundError(
      "SACCO not found"
    );
  }

  sacco.status =
    ONBOARDING_STATUS.REJECTED;

  sacco.rejectionReason =
    reason;

  sacco.rejectedBy =
    user?.id;

  sacco.rejectedAt =
    new Date();

  await sacco.save();

  return sacco;
};

/**
 * ============================================================
 * Onboarding Progress
 * ============================================================
 */
exports.getProgress = async (
  saccoId
) => {
  const sacco =
    await Sacco.findById(saccoId);

  if (!sacco) {
    throw new NotFoundError(
      "SACCO not found"
    );
  }

  const checkpoints = {
    registration: true,
    kyc:
      sacco.status ===
        ONBOARDING_STATUS.KYC_APPROVED ||
      sacco.status ===
        ONBOARDING_STATUS.SUBSCRIPTION ||
      sacco.status ===
        ONBOARDING_STATUS.LIVE,
    subscription:
      sacco.status ===
        ONBOARDING_STATUS.SUBSCRIPTION ||
      sacco.status ===
        ONBOARDING_STATUS.LIVE,
    live:
      sacco.status ===
      ONBOARDING_STATUS.LIVE
  };

  const completed =
    Object.values(checkpoints)
      .filter(Boolean).length;

  return {
    saccoId: sacco._id,
    status: sacco.status,
    progressPercentage:
      Math.round(
        (completed / 4) * 100
      ),
    checkpoints
  };
};

/**
 * ============================================================
 * Dashboard Metrics
 * ============================================================
 */
exports.metrics = async () => {
  const [
    totalSaccos,
    draft,
    kycApproved,
    subscription,
    live
  ] = await Promise.all([
    Sacco.countDocuments(),
    Sacco.countDocuments({
      status: ONBOARDING_STATUS.DRAFT
    }),
    Sacco.countDocuments({
      status:
        ONBOARDING_STATUS.KYC_APPROVED
    }),
    Sacco.countDocuments({
      status:
        ONBOARDING_STATUS.SUBSCRIPTION
    }),
    Sacco.countDocuments({
      status:
        ONBOARDING_STATUS.LIVE
    })
  ]);

  return {
    totalSaccos,
    draft,
    kycApproved,
    subscription,
    live
  };
};

/**
 * ============================================================
 * Change Status
 * ============================================================
 */
exports.updateStatus = async (
  saccoId,
  status
) => {
  const sacco =
    await Sacco.findById(saccoId);

  if (!sacco) {
    throw new NotFoundError(
      "SACCO not found"
    );
  }

  sacco.status = status;

  await sacco.save();

  return sacco;
};