# Quick Start Guide - Community Savings App Backend

## Prerequisites

- Node.js 14+ and npm
- MongoDB 4.4+ (or MongoDB Atlas)
- Git

## Installation

### 1. Clone and Install Dependencies

```bash
cd community-savings-app-backend
npm install
```

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
# Required variables:
MONGO_URI=mongodb://localhost:27017/community-savings
JWT_SECRET=your-secret-key-min-32-chars
NODE_ENV=development
PORT=5000
```

### 3. Database Setup

```bash
# Initialize database indexes (one-time)
node -e "require('./config/performanceOptimization').initializeIndexes()"

# Seed admin user (for development)
npm run seed-admin

# Or seed local data
npm run seed-local
```

## Running the Application

### Development Mode

```bash
# With auto-reload on file changes
npm run dev

# Server runs on http://localhost:5000
```

### Production Mode

```bash
# Start with PM2 for process management
npm install -g pm2
pm2 start server.js --name "community-savings"

# Monitor
pm2 monitor
```

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- loans.test.js

# Watch mode
npm run test:watch
```

## API Documentation

### Access Swagger UI

Once server is running:
```
http://localhost:5000/api-docs
```

### Key Endpoints

#### Authentication
```bash
# Register
POST /api/auth/register
Body: { name, email, password, phone }

# Login
POST /api/auth/login
Body: { email, password }
```

#### Loans
```bash
# Check eligibility
GET /api/loans/eligibility/:groupId
Header: Authorization: Bearer <token>

# Request loan
POST /api/loans/request
Body: { groupId, amount, reason, repaymentTermMonths }

# Get loan details
GET /api/loans/:loanId

# Approve loan (admin)
PATCH /api/loans/:loanId/approve
Body: { interestRate, repaymentPeriodMonths }

# Disburse loan (admin)
PATCH /api/loans/:loanId/disburse

# Record payment
POST /api/loans/:loanId/repay
Body: { amount, paymentMethod }
```

#### Admin
```bash
# Dashboard metrics
GET /api/admin/dashboard

# Loan analytics
GET /api/admin/analytics/loans?period=30d

# System health
GET /api/admin/system/health
```

## Project Structure

```
community-savings-app-backend/
├── config/
│   ├── db.js                         # Database configuration
│   ├── swaggerConfig.js              # API documentation
│   └── performanceOptimization.js    # Database optimization
├── controllers/
│   ├── loanController.js             # Loan endpoints
│   ├── adminController.js            # Admin dashboard
│   ├── authController.js             # Authentication
│   ├── groupController.js            # Group management
│   └── ...
├── models/
│   ├── User.js
│   ├── Loan.js
│   ├── LoanEligibility.js
│   ├── LoanRepaymentSchedule.js
│   ├── LoanAudit.js
│   └── ...
├── routes/
│   ├── loans.js                      # Loan routes
│   ├── auth.js                       # Auth routes
│   └── ...
├── services/
│   ├── loanScoringService.js         # Eligibility scoring
│   ├── emailService.js               # Email functionality
│   └── ...
├── middleware/
│   ├── auth.js                       # JWT authentication
│   ├── securityHardening.js          # Security middleware
│   └── ...
├── tests/
│   ├── integration/
│   │   └── controllers/
│   │       ├── loans.test.js         # Loan integration tests
│   │       └── ...
│   └── setup.js                      # Test configuration
├── server.js                          # Application entry point
├── package.json
└── README.md
```

## Key Features

### Loan Management
- ✅ Eligibility scoring (4-component algorithm)
- ✅ Complete loan lifecycle (apply → approve → disburse → repay)
- ✅ Automatic repayment schedule generation
- ✅ Payment tracking with on-time/late detection
- ✅ Default detection and alerting

### Security
- ✅ JWT authentication
- ✅ Role-based access control
- ✅ Rate limiting (multiple layers)
- ✅ Input validation & sanitization
- ✅ CSRF protection
- ✅ Secure password hashing

### Admin Features
- ✅ Comprehensive dashboard
- ✅ User analytics
- ✅ Loan analytics with trends
- ✅ Payment collection metrics
- ✅ Compliance reporting
- ✅ System health monitoring
- ✅ Audit trail

### Performance
- ✅ 50+ optimized database indexes
- ✅ Query optimization with lean()
- ✅ Aggregation pipelines for analytics
- ✅ Caching ready (Redis integration)
- ✅ Connection pooling
- ✅ Response time < 200ms (p95)

## Troubleshooting

### Connection Issues

```bash
# Test MongoDB connection
mongo mongodb://localhost:27017/community-savings

# Check if MongoDB is running
ps aux | grep mongod

# Start MongoDB (if using local)
mongod --dbpath /path/to/data
```

### Port Already in Use

```bash
# Find process using port 5000
lsof -i :5000

# Kill process
kill -9 <PID>
```

### JWT Token Errors

```bash
# Ensure JWT_SECRET is set
echo $JWT_SECRET

# Regenerate if needed
openssl rand -base64 32
```

### Test Failures

```bash
# Clear MongoDB test database
mongo mongodb://localhost:27017/community-savings-test --eval "db.dropDatabase()"

# Run tests with debug output
DEBUG=* npm test
```

## Development Workflow

### Adding a New Endpoint

1. **Create route** in `/routes/loans.js`
   ```javascript
   router.post('/new', verifyToken, validateInputs, controller);
   ```

2. **Implement controller** in `/controllers/loanController.js`
   ```javascript
   exports.newEndpoint = asyncHandler(async (req, res) => {
     // Implementation
   });
   ```

3. **Add tests** in `/tests/integration/controllers/loans.test.js`
   ```javascript
   it('should do something', async () => {
     // Test
   });
   ```

4. **Update Swagger** in `/config/swaggerConfig.js`

### Database Migration

```bash
# Create new migration
node scripts/migrate.js create_migration_name

# Run migrations
npm run migrate

# Check status
npm run migrate:status

# Rollback
npm run migrate:down
```

## Performance Tuning

### Monitor Performance

```javascript
// In your code
const start = Date.now();
const result = await someQuery();
console.log(`Query took ${Date.now() - start}ms`);
```

### Enable Query Logging

```javascript
// In server.js
mongoose.set('debug', true);
```

### Database Stats

```bash
# Connect to MongoDB
mongo mongodb://localhost:27017/community-savings

# Get stats
db.stats()
db.loans.stats()

# Check indexes
db.loans.getIndexes()
```

## Deployment

### Pre-deployment Checklist

```bash
# Run tests
npm test

# Check code quality
npm run lint

# Generate documentation
npm run docs

# Build for production
npm run build
```

### Deploy to Production

See [PRODUCTION_DEPLOYMENT_COMPLETE.md](./PRODUCTION_DEPLOYMENT_COMPLETE.md) for detailed deployment instructions.

## Support

### Documentation
- **API Docs**: http://localhost:5000/api-docs (Swagger UI)
- **Implementation Guide**: [IMPLEMENTATION_COMPLETE_SUMMARY.md](./IMPLEMENTATION_COMPLETE_SUMMARY.md)
- **Deployment Guide**: [PRODUCTION_DEPLOYMENT_COMPLETE.md](./PRODUCTION_DEPLOYMENT_COMPLETE.md)

### Common Tasks

**Check loan status**
```javascript
const loan = await Loan.findById(loanId).populate('user').populate('group');
console.log(loan);
```

**Get user's loans**
```javascript
const loans = await Loan.find({ user: userId }).populate('group');
```

**Check eligibility**
```javascript
const { assessEligibility } = require('./services/loanScoringService');
const eligibility = await assessEligibility(userId, groupId, adminId);
```

**View audit trail**
```javascript
const audit = await LoanAudit.find({ user: userId }).sort({ createdAt: -1 });
```

## Links

- **Repository**: https://github.com/titech-africa/community-savings-app
- **Issue Tracker**: https://github.com/titech-africa/community-savings-app/issues
- **Wiki**: https://github.com/titech-africa/community-savings-app/wiki
- **Status Page**: https://status.community-savings.app

---

**Happy coding!** 🚀

For more information, see the complete [README.md](./README.md).
