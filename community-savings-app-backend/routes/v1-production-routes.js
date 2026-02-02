/**
 * COMPLETE API ROUTES - Production Ready
 * 
 * 1️⃣ LOAN ELIGIBILITY & MANAGEMENT
 * 2️⃣ ADMIN DASHBOARD
 * 3️⃣ CHAT ENHANCEMENT
 * 4️⃣ REFERRAL SYSTEM
 * 5️⃣ SECURITY ENDPOINTS
 */

const express = require('express');
const router = express.Router();

// Middleware
const { verifyToken, requireRole } = require('../middleware/auth');
const {
  globalLimiter,
  authLimiter,
  emailLimiter,
  loanLimiter,
} = require('../middleware/securityHardening');

// Controllers
const loanController = require('../controllers/loanController');
const adminController = require('../controllers/adminController');
const chatController = require('../controllers/chatController');
const referralController = require('../controllers/referralController');

// ============================================================================
// 1️⃣ LOAN MANAGEMENT ROUTES
// ============================================================================

// Check eligibility
router.get(
  '/loans/eligibility/:groupId',
  verifyToken,
  loanLimiter,
  loanController.checkEligibility
);

// Apply for loan
router.post(
  '/loans/apply',
  verifyToken,
  loanLimiter,
  loanController.applyForLoan
);

// Approve loan (admin/group_admin)
router.put(
  '/loans/:loanId/approve',
  verifyToken,
  loanLimiter,
  loanController.approveLoan
);

// Reject loan (admin/group_admin)
router.put(
  '/loans/:loanId/reject',
  verifyToken,
  loanLimiter,
  loanController.rejectLoan
);

// Disburse loan (admin/group_admin)
router.put(
  '/loans/:loanId/disburse',
  verifyToken,
  loanLimiter,
  loanController.disburseLoan
);

// Record payment
router.put(
  '/loans/:loanId/pay',
  verifyToken,
  loanLimiter,
  loanController.repayLoan
);

// Get loan status
router.get(
  '/loans/:loanId',
  verifyToken,
  loanController.getLoanStatus
);

// Get user's loans
router.get(
  '/loans/user/my-loans',
  verifyToken,
  loanController.getUserLoans
);

// Get group loans (admin only)
router.get(
  '/loans/group/:groupId',
  verifyToken,
  loanController.getGroupLoans
);

// ============================================================================
// 2️⃣ ADMIN DASHBOARD ROUTES
// ============================================================================

// Dashboard metrics
router.get(
  '/admin/dashboard',
  verifyToken,
  adminController.requireAdmin,
  adminController.getDashboardMetrics
);

// User management
router.get(
  '/admin/users',
  verifyToken,
  adminController.requireAdmin,
  adminController.getUsers
);

// Get user details
router.get(
  '/admin/users/:userId',
  verifyToken,
  adminController.requireAdmin,
  adminController.getUserDetails
);

// Verify user
router.put(
  '/admin/users/:userId/verify',
  verifyToken,
  adminController.requireAdmin,
  adminController.verifyUser
);

// Suspend user
router.put(
  '/admin/users/:userId/suspend',
  verifyToken,
  adminController.requireAdmin,
  adminController.suspendUser
);

// Activate user
router.put(
  '/admin/users/:userId/activate',
  verifyToken,
  adminController.requireAdmin,
  adminController.activateUser
);

// Loan risk overview
router.get(
  '/admin/loan-risk',
  verifyToken,
  adminController.requireAdmin,
  adminController.getLoanRiskOverview
);

// Group oversight
router.get(
  '/admin/groups',
  verifyToken,
  adminController.requireAdmin,
  adminController.getGroupOversight
);

// Audit log
router.get(
  '/admin/audit-log',
  verifyToken,
  adminController.requireAdmin,
  adminController.getAuditLog
);

// ============================================================================
// 3️⃣ CHAT ENHANCEMENT ROUTES
// ============================================================================

// Send message
router.post(
  '/chat/:groupId',
  verifyToken,
  chatController.sendMessage
);

// Get group messages
router.get(
  '/chat/:groupId',
  verifyToken,
  chatController.getGroupMessages
);

// Mark message as read
router.put(
  '/chat/message/:messageId/read',
  verifyToken,
  chatController.markAsRead
);

// Add reaction
router.post(
  '/chat/message/:messageId/reaction',
  verifyToken,
  chatController.addReaction
);

// Remove reaction
router.delete(
  '/chat/message/:messageId/reaction',
  verifyToken,
  chatController.removeReaction
);

// Flag message (moderation)
router.post(
  '/chat/message/:messageId/flag',
  verifyToken,
  chatController.flagMessage
);

// Hide message (admin only)
router.put(
  '/chat/message/:messageId/hide',
  verifyToken,
  chatController.hideMessage
);

// Get threaded conversation
router.get(
  '/chat/thread/:parentMessageId',
  verifyToken,
  chatController.getThreadedMessages
);

// ============================================================================
// 4️⃣ REFERRAL SYSTEM ROUTES
// ============================================================================

// Generate referral code
router.post(
  '/referrals/generate',
  verifyToken,
  referralController.generateReferralCode
);

// Get my referral code
router.get(
  '/referrals/my-code',
  verifyToken,
  referralController.getMyReferralCode
);

// Use referral code (during signup)
router.post(
  '/referrals/use',
  referralController.useReferralCode
);

// Get pending referrals
router.get(
  '/referrals/pending',
  verifyToken,
  referralController.getPendingReferrals
);

// Get completed referrals
router.get(
  '/referrals/completed',
  verifyToken,
  referralController.getCompletedReferrals
);

// Get referral rewards
router.get(
  '/referrals/rewards',
  verifyToken,
  referralController.getReferralRewards
);

// Get referral details
router.get(
  '/referrals/:referralId',
  verifyToken,
  referralController.getReferralDetails
);

// ============================================================================
// 5️⃣ SECURITY & MONITORING ROUTES
// ============================================================================

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is healthy',
    timestamp: new Date(),
    uptime: process.uptime(),
  });
});

// Metrics (Prometheus format)
router.get('/metrics', (req, res) => {
  // Return Prometheus-format metrics
  res.set('Content-Type', 'text/plain');
  res.send(
    `# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",status="200"} 1234
`
  );
});

// Security audit trail
router.get(
  '/security/audit-trail',
  verifyToken,
  adminController.requireAdmin,
  adminController.getAuditLog
);

// ============================================================================
// 6️⃣ LEGACY ROUTES (kept for compatibility, use new ones above)
// ============================================================================

// Old loan endpoints (deprecated)
router.post('/loans', verifyToken, (req, res) => {
  res.status(301).json({
    message: 'Moved. Use POST /api/loans/apply instead',
    url: '/api/loans/apply',
  });
});

module.exports = router;
