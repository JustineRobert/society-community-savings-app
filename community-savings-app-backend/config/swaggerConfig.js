/**
 * swaggerConfig.js
 * 
 * OpenAPI 3.0 / Swagger documentation configuration
 * Production-ready API documentation with examples
 */

module.exports = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Community Savings App API',
      version: '1.0.0',
      description: 'Production-ready REST API for community savings management system with loan management, contributions, and group management',
      contact: {
        name: 'TITech Africa',
        email: 'support@titech.africa',
      },
      license: {
        name: 'ISC',
      },
    },
    servers: [
      {
        url: 'http://localhost:5000/api',
        description: 'Development server',
      },
      {
        url: 'https://api.community-savings.app/api',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from login endpoint',
        },
      },
      schemas: {
        // User schemas
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string', description: 'User ID' },
            name: { type: 'string', example: 'John Doe' },
            email: { type: 'string', format: 'email', example: 'john@example.com' },
            phone: { type: 'string', example: '+1234567890' },
            role: {
              type: 'string',
              enum: ['user', 'group_admin', 'admin'],
              example: 'user',
            },
            isVerified: { type: 'boolean', example: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },

        // Loan schemas
        Loan: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            user: { type: 'string', description: 'User ID' },
            group: { type: 'string', description: 'Group ID' },
            amount: { type: 'number', example: 50000 },
            status: {
              type: 'string',
              enum: ['pending', 'approved', 'rejected', 'disbursed', 'repaid'],
              example: 'pending',
            },
            interestRate: { type: 'number', example: 5 },
            repaymentPeriodMonths: { type: 'number', example: 6 },
            eligibilityScore: { type: 'number', example: 75.5 },
            reason: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            approvedAt: { type: 'string', format: 'date-time' },
            disburseDate: { type: 'string', format: 'date-time' },
            repaidAt: { type: 'string', format: 'date-time' },
          },
        },

        LoanEligibility: {
          type: 'object',
          properties: {
            isEligible: { type: 'boolean', example: true },
            overallScore: { type: 'number', minimum: 0, maximum: 100, example: 72.5 },
            maxLoanAmount: { type: 'number', example: 125000 },
            rejectionReason: {
              type: 'string',
              example: 'insufficient_contribution',
            },
            components: {
              type: 'object',
              properties: {
                contributionScore: { type: 'number', maximum: 40, example: 30 },
                participationScore: { type: 'number', maximum: 30, example: 22 },
                repaymentScore: { type: 'number', maximum: 20, example: 15 },
                riskScore: { type: 'number', maximum: 10, example: 5.5 },
              },
            },
            metadata: {
              type: 'object',
              properties: {
                totalContributed: { type: 'number', example: 50000 },
                monthsActive: { type: 'number', example: 6 },
                contributionCount: { type: 'number', example: 10 },
                activeLoans: { type: 'number', example: 1 },
              },
            },
          },
        },

        LoanRepaymentSchedule: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            loan: { type: 'string' },
            installments: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  installmentNumber: { type: 'number' },
                  amount: { type: 'number' },
                  dueDate: { type: 'string', format: 'date-time' },
                  paid: { type: 'boolean' },
                  paidAt: { type: 'string', format: 'date-time' },
                },
              },
            },
            totalAmount: { type: 'number' },
            totalPaid: { type: 'number' },
            interestRate: { type: 'number' },
            status: {
              type: 'string',
              enum: ['active', 'completed', 'defaulted'],
            },
          },
        },

        // Group schemas
        Group: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string', example: 'Community Group A' },
            description: { type: 'string' },
            members: {
              type: 'array',
              items: { type: 'string', description: 'User IDs' },
            },
            admin: { type: 'string', description: 'Admin user ID' },
            status: {
              type: 'string',
              enum: ['active', 'inactive'],
              example: 'active',
            },
            rules: {
              type: 'object',
              properties: {
                minContribution: { type: 'number', example: 5000 },
                maxLoanMultiplier: { type: 'number', example: 2.5 },
                loanInterestRate: { type: 'number', example: 5 },
              },
            },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },

        // Contribution schemas
        Contribution: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            user: { type: 'string' },
            group: { type: 'string' },
            amount: { type: 'number', example: 5000 },
            status: {
              type: 'string',
              enum: ['pending', 'completed', 'failed'],
              example: 'completed',
            },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },

        // Error response
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Resource not found' },
            errors: { type: 'object' },
          },
        },

        // Success response
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string' },
            data: { type: 'object' },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    paths: {
      // Authentication
      '/auth/register': {
        post: {
          summary: 'Register a new user',
          tags: ['Authentication'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', example: 'John Doe' },
                    email: { type: 'string', format: 'email', example: 'john@example.com' },
                    password: { type: 'string', minLength: 8, example: 'SecurePass123' },
                    phone: { type: 'string', example: '+1234567890' },
                  },
                  required: ['name', 'email', 'password', 'phone'],
                },
              },
            },
          },
          responses: {
            201: {
              description: 'User registered successfully',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/SuccessResponse',
                  },
                },
              },
            },
            400: {
              description: 'Invalid input or user already exists',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ErrorResponse',
                  },
                },
              },
            },
          },
        },
      },

      '/auth/login': {
        post: {
          summary: 'Login user',
          tags: ['Authentication'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    email: { type: 'string', format: 'email', example: 'john@example.com' },
                    password: { type: 'string', example: 'SecurePass123' },
                  },
                  required: ['email', 'password'],
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Login successful',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      token: { type: 'string', description: 'JWT token' },
                      user: { $ref: '#/components/schemas/User' },
                    },
                  },
                },
              },
            },
            401: {
              description: 'Invalid credentials',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ErrorResponse',
                  },
                },
              },
            },
          },
        },
      },

      // Loans
      '/loans/eligibility/{groupId}': {
        get: {
          summary: 'Check loan eligibility',
          tags: ['Loans'],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'groupId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Group ID',
            },
          ],
          responses: {
            200: {
              description: 'Eligibility assessment',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: { $ref: '#/components/schemas/LoanEligibility' },
                    },
                  },
                },
              },
            },
          },
        },
      },

      '/loans/request': {
        post: {
          summary: 'Submit a loan request',
          tags: ['Loans'],
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    groupId: { type: 'string', example: '60d5ec49c1234567890abcde' },
                    amount: { type: 'number', example: 50000 },
                    reason: { type: 'string', example: 'Business expansion' },
                    repaymentTermMonths: { type: 'number', example: 6 },
                  },
                  required: ['groupId', 'amount'],
                },
              },
            },
          },
          responses: {
            201: {
              description: 'Loan request submitted',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: { $ref: '#/components/schemas/Loan' },
                    },
                  },
                },
              },
            },
          },
        },
      },

      '/loans/{loanId}': {
        get: {
          summary: 'Get loan details',
          tags: ['Loans'],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'loanId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            200: {
              description: 'Loan details',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          loan: { $ref: '#/components/schemas/Loan' },
                          schedule: { $ref: '#/components/schemas/LoanRepaymentSchedule' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },

      '/loans/{loanId}/approve': {
        patch: {
          summary: 'Approve a loan (Admin only)',
          tags: ['Loans'],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'loanId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    interestRate: { type: 'number', example: 5, minimum: 0, maximum: 100 },
                    repaymentPeriodMonths: { type: 'number', example: 6, minimum: 1, maximum: 60 },
                    notes: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Loan approved',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: { $ref: '#/components/schemas/Loan' },
                    },
                  },
                },
              },
            },
          },
        },
      },

      '/loans/{loanId}/disburse': {
        patch: {
          summary: 'Disburse an approved loan (Admin only)',
          tags: ['Loans'],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'loanId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    paymentMethod: { type: 'string', example: 'bank_transfer' },
                    notes: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Loan disbursed',
            },
          },
        },
      },

      '/loans/{loanId}/repay': {
        post: {
          summary: 'Record a loan repayment',
          tags: ['Loans'],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'loanId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    amount: { type: 'number', example: 2000 },
                    paymentMethod: { type: 'string', example: 'cash' },
                    notes: { type: 'string' },
                  },
                  required: ['amount'],
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Payment recorded',
            },
          },
        },
      },

      // Admin endpoints
      '/admin/dashboard': {
        get: {
          summary: 'Get dashboard metrics (Admin only)',
          tags: ['Admin'],
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Dashboard metrics',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          users: { type: 'object' },
                          groups: { type: 'object' },
                          contributions: { type: 'object' },
                          loans: { type: 'object' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },

      '/admin/analytics/loans': {
        get: {
          summary: 'Get loan analytics (Admin only)',
          tags: ['Admin'],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'period',
              in: 'query',
              schema: { type: 'string', enum: ['7d', '30d', '90d', 'all'], default: '30d' },
            },
          ],
          responses: {
            200: {
              description: 'Loan analytics',
            },
          },
        },
      },

      '/admin/system/health': {
        get: {
          summary: 'Get system health status (Admin only)',
          tags: ['Admin'],
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'System health status',
            },
          },
        },
      },
    },
  },
  apis: [],
};
