# API REFERENCE - Quick Start

## Authentication
All protected endpoints require:
```
Authorization: Bearer {accessToken}
or
x-auth-token: {accessToken}
```

---

## 🎯 LOAN MANAGEMENT

### Check Eligibility
```
GET /api/loans/eligibility/:groupId
Authorization: Bearer token
Response:
{
  "success": true,
  "data": {
    "isEligible": true,
    "overallScore": 75.5,
    "maxLoanAmount": 50000,
    "rejectionReason": null,
    "components": {
      "contributionScore": 35,
      "participationScore": 25,
      "repaymentScore": 15,
      "riskScore": 10
    },
    "metadata": {
      "monthsActive": 6,
      "totalContributed": 20000,
      "completedLoans": 1,
      "onTimeRepaymentRate": 100
    }
  }
}
```

### Apply for Loan
```
POST /api/loans/apply
Content-Type: application/json
Authorization: Bearer token

Body:
{
  "groupId": "507f1f77bcf86cd799439011",
  "amount": 30000,
  "reason": "Business expansion",
  "idempotencyKey": "unique-key-123"
}

Response (201):
{
  "success": true,
  "message": "Loan application submitted successfully",
  "data": {
    "_id": "507f...",
    "user": "...",
    "group": "...",
    "amount": 30000,
    "status": "pending",
    "eligibilityScore": 75.5,
    "createdAt": "2026-02-02T10:00:00Z"
  }
}
```

### Approve Loan
```
PUT /api/loans/:loanId/approve
Authorization: Bearer token (admin only)

Body:
{
  "interestRate": 5,
  "repaymentPeriodMonths": 6,
  "notes": "Approved for expansion business"
}

Response:
{
  "success": true,
  "message": "Loan approved successfully",
  "data": { loan object with status: "approved" }
}
```

### Reject Loan
```
PUT /api/loans/:loanId/reject
Authorization: Bearer token (admin only)

Body:
{
  "reason": "Insufficient contribution history"
}

Response:
{
  "success": true,
  "message": "Loan rejected",
  "data": { loan object with status: "rejected" }
}
```

### Disburse Loan
```
PUT /api/loans/:loanId/disburse
Authorization: Bearer token (admin only)

Body:
{
  "paymentMethod": "bank_transfer",
  "notes": "Transferred to user account"
}

Response:
{
  "success": true,
  "message": "Loan disbursed successfully",
  "data": {
    "loan": { ...loan details },
    "schedule": {
      "installments": [...],
      "totalAmount": 30000,
      "interestRate": 5,
      "status": "active"
    }
  }
}
```

### Make Payment
```
PUT /api/loans/:loanId/pay
Authorization: Bearer token

Body:
{
  "amount": 5500,
  "paymentMethod": "mobile_money",
  "notes": "Monthly payment"
}

Response:
{
  "success": true,
  "message": "Payment recorded successfully",
  "data": {
    "loan": { ...updated loan },
    "schedule": { ...updated schedule },
    "paymentRecord": {
      "amount": 5500,
      "method": "mobile_money",
      "paidAt": "2026-02-02T10:00:00Z"
    }
  }
}
```

### Get Loan Details
```
GET /api/loans/:loanId
Authorization: Bearer token

Response:
{
  "success": true,
  "data": {
    "loan": {
      "_id": "...",
      "user": { name, email, phone },
      "group": { name },
      "amount": 30000,
      "status": "disbursed",
      "interestRate": 5,
      "repaymentPeriodMonths": 6,
      "approvedBy": { name, email }
    },
    "schedule": {
      "installments": [...],
      "totalPaid": 5500,
      "outstandingAmount": 24500
    }
  }
}
```

---

## 👨‍💼 ADMIN DASHBOARD

### Dashboard Metrics
```
GET /api/admin/dashboard
Authorization: Bearer token (admin only)

Response:
{
  "success": true,
  "data": {
    "users": {
      "total": 250,
      "verified": 200,
      "unverified": 50
    },
    "groups": {
      "total": 15,
      "active": 12
    },
    "contributions": {
      "total": 500000,
      "count": 1200
    },
    "loans": {
      "total": 45,
      "disbursed": 15,
      "disbursedAmount": 300000,
      "repaid": 20,
      "defaulted": 2,
      "pending": 8,
      "defaultRate": "4.44%"
    }
  }
}
```

### List Users
```
GET /api/admin/users?status=all&search=john&skip=0&limit=20
Authorization: Bearer token (admin only)

Response:
{
  "success": true,
  "count": 20,
  "total": 250,
  "data": [
    {
      "_id": "...",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+256700000000",
      "role": "user",
      "isVerified": true,
      "createdAt": "2026-01-01T10:00:00Z"
    }
  ]
}
```

### User Details
```
GET /api/admin/users/:userId
Authorization: Bearer token (admin only)

Response:
{
  "success": true,
  "data": {
    "user": { ...user details },
    "activity": {
      "groups": 3,
      "loans": 2,
      "contributions": 12
    },
    "recentActivity": [ ...audit logs ]
  }
}
```

### Verify User
```
PUT /api/admin/users/:userId/verify
Authorization: Bearer token (admin only)

Response:
{
  "success": true,
  "message": "User verified successfully"
}
```

### Suspend User
```
PUT /api/admin/users/:userId/suspend
Authorization: Bearer token (admin only)

Body:
{
  "reason": "Multiple fraud attempts"
}

Response:
{
  "success": true,
  "message": "User suspended successfully"
}
```

### Loan Risk Overview
```
GET /api/admin/loan-risk
Authorization: Bearer token (admin only)

Response:
{
  "success": true,
  "data": {
    "atRisk": {
      "count": 3,
      "totalAmount": 45000
    },
    "approachingMaturity": 5,
    "defaultAnalysis": {
      "count": 2,
      "totalAmount": 20000,
      "avgAmount": 10000
    }
  }
}
```

### Audit Log
```
GET /api/admin/audit-log?action=loan_approved&skip=0&limit=50
Authorization: Bearer token (admin only)

Response:
{
  "success": true,
  "count": 20,
  "total": 150,
  "data": [
    {
      "_id": "...",
      "action": "loan_approved",
      "user": { name, email },
      "actor": { name, email, role },
      "description": "Loan approved: 30000, 5% interest, 6 months",
      "amount": 30000,
      "changes": { before, after },
      "createdAt": "2026-02-02T10:00:00Z"
    }
  ]
}
```

---

## 💬 CHAT

### Send Message
```
POST /api/chat/:groupId
Authorization: Bearer token

Body:
{
  "message": "How are we progressing with savings?",
  "messageType": "text"
}

Response:
{
  "success": true,
  "data": {
    "_id": "...",
    "group": "...",
    "sender": { name, email },
    "message": "...",
    "messageType": "text",
    "readBy": [],
    "reactions": [],
    "createdAt": "2026-02-02T10:00:00Z"
  }
}
```

### Get Group Messages
```
GET /api/chat/:groupId?skip=0&limit=50
Authorization: Bearer token

Response:
{
  "success": true,
  "count": 50,
  "total": 150,
  "data": [ ...messages ]
}
```

### Mark as Read
```
PUT /api/chat/message/:messageId/read
Authorization: Bearer token

Response:
{
  "success": true,
  "data": { ...message with updated readBy }
}
```

### Add Reaction
```
POST /api/chat/message/:messageId/reaction
Authorization: Bearer token

Body:
{
  "emoji": "👍"
}

Response:
{
  "success": true,
  "data": { ...message with reactions updated }
}
```

### Flag Message
```
POST /api/chat/message/:messageId/flag
Authorization: Bearer token

Body:
{
  "reason": "Inappropriate language"
}

Response:
{
  "success": true,
  "data": { ...message with flag recorded }
}
```

### Hide Message (Admin)
```
PUT /api/chat/message/:messageId/hide
Authorization: Bearer token (admin only)

Body:
{
  "reason": "Violates community guidelines"
}

Response:
{
  "success": true,
  "data": { ...message with isHidden: true }
}
```

---

## 🤝 REFERRAL

### Generate Code
```
POST /api/referrals/generate
Authorization: Bearer token

Response:
{
  "success": true,
  "data": {
    "referralCode": "REF-A1B2C3D4-1FABC9X",
    "expiresAt": "2026-05-02T10:00:00Z",
    "shareUrl": "https://app.example.com/join?ref=REF-A1B2C3D4-1FABC9X"
  }
}
```

### Get My Code
```
GET /api/referrals/my-code
Authorization: Bearer token

Response:
{
  "success": true,
  "data": { referral code object }
}
```

### Use Referral Code
```
POST /api/referrals/use
Content-Type: application/json

Body:
{
  "referralCode": "REF-A1B2C3D4-1FABC9X"
}
# Called during user signup

Response:
{
  "success": true,
  "message": "Referral code accepted"
}
```

### Pending Referrals
```
GET /api/referrals/pending
Authorization: Bearer token

Response:
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "referralCode": "...",
      "referee": { name, email },
      "status": "pending",
      "expiresAt": "..."
    }
  ]
}
```

### Completed Referrals
```
GET /api/referrals/completed
Authorization: Bearer token

Response:
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "referee": { name, email },
      "status": "completed",
      "rewardAmount": 500,
      "rewardType": "bonus_credit",
      "rewardIssuedAt": "2026-02-01T10:00:00Z"
    }
  ]
}
```

### Referral Rewards
```
GET /api/referrals/rewards
Authorization: Bearer token

Response:
{
  "success": true,
  "data": {
    "totalRewards": 2500,
    "completedCount": 5,
    "rewardType": "bonus_credit"
  }
}
```

---

## 🔒 SECURITY

### Health Check
```
GET /api/health

Response:
{
  "success": true,
  "message": "API is healthy",
  "timestamp": "2026-02-02T10:00:00Z",
  "uptime": 3600
}
```

### Metrics
```
GET /api/metrics

Response: (Prometheus format)
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",status="200"} 1234
...
```

---

## 📋 ERROR RESPONSES

### 400 Bad Request
```json
{
  "success": false,
  "message": "Invalid group ID"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "No token provided, authorization denied"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Only admins can approve loans"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Loan not found"
}
```

### 409 Conflict
```json
{
  "success": false,
  "message": "You already have a pending or active loan in this group"
}
```

### 429 Too Many Requests
```json
{
  "success": false,
  "message": "Too many requests from this IP, please try again after 15 minutes"
}
```

### 500 Server Error
```json
{
  "success": false,
  "message": "Internal server error"
}
```

---

## 🚀 Quick Start Example

```bash
# 1. Check eligibility
curl -X GET http://localhost:5000/api/loans/eligibility/groupId \
  -H "Authorization: Bearer token"

# 2. Apply for loan
curl -X POST http://localhost:5000/api/loans/apply \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{
    "groupId": "...",
    "amount": 30000,
    "reason": "Business"
  }'

# 3. Admin approves (as admin user)
curl -X PUT http://localhost:5000/api/loans/loanId/approve \
  -H "Authorization: Bearer adminToken" \
  -H "Content-Type: application/json" \
  -d '{
    "interestRate": 5,
    "repaymentPeriodMonths": 6
  }'

# 4. Make payment
curl -X PUT http://localhost:5000/api/loans/loanId/pay \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5500,
    "paymentMethod": "mobile_money"
  }'
```

---

**API Version**: 2.0  
**Last Updated**: February 2, 2026  
**Status**: Production Ready
