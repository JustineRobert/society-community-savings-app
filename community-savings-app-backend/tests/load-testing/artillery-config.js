/**
 * Artillery Load Testing Configuration
 * ============================================================================
 * Performance and load testing scenarios for Community Savings App
 *
 * Run: artillery run artillery-config.yml --target https://api.example.com
 */

module.exports = {
  config: {
    target: process.env.TARGET_URL || 'http://localhost:5000',
    phases: [
      {
        duration: 60,
        arrivalRate: 10,
        name: 'Warm up',
      },
      {
        duration: 300,
        arrivalRate: 50,
        rampTo: 200,
        name: 'Ramp up to 200 users',
      },
      {
        duration: 300,
        arrivalRate: 200,
        name: 'Sustained load',
      },
      {
        duration: 60,
        arrivalRate: 10,
        name: 'Cool down',
      },
    ],
    processor: './artillery-processor.js',
    variables: {
      baseUrl: process.env.BASE_URL || 'http://localhost:5000',
    },
    defaults: {
      headers: {
        'User-Agent': 'Artillery Load Tester',
        'Content-Type': 'application/json',
      },
    },
    plugins: {
      expect: {},
    },
  },

  scenarios: [
    {
      name: 'Authentication Flow',
      weight: 10,
      flow: [
        {
          post: {
            url: '/api/auth/register',
            json: {
              email: '{{ $randomString(10) }}@example.com',
              password: 'TestPassword123!',
              fullName: 'Load Test User',
              phoneNumber: '+254712345678',
            },
            capture: {
              json: '$.token',
              as: 'authToken',
            },
          },
        },
        {
          think: 2,
        },
        {
          post: {
            url: '/api/auth/login',
            json: {
              email: '{{ authEmail }}',
              password: 'TestPassword123!',
            },
            capture: {
              json: '$.token',
              as: 'authToken',
            },
          },
        },
      ],
    },

    {
      name: 'Group Operations',
      weight: 15,
      flow: [
        {
          post: {
            url: '/api/auth/login',
            json: {
              email: 'loadtest@example.com',
              password: 'TestPassword123!',
            },
            capture: {
              json: '$.token',
              as: 'authToken',
            },
          },
        },
        {
          post: {
            url: '/api/groups',
            headers: {
              Authorization: 'Bearer {{ authToken }}',
            },
            json: {
              name: 'Load Test Group {{ $randomString(5) }}',
              description: 'Group for load testing',
              targetAmount: 10000,
            },
            expect: [
              {
                statusCode: 201,
              },
            ],
            capture: {
              json: '$.group._id',
              as: 'groupId',
            },
          },
        },
        {
          get: {
            url: '/api/groups/{{ groupId }}',
            headers: {
              Authorization: 'Bearer {{ authToken }}',
            },
            expect: [
              {
                statusCode: 200,
              },
            ],
          },
        },
        {
          get: {
            url: '/api/groups',
            headers: {
              Authorization: 'Bearer {{ authToken }}',
            },
            expect: [
              {
                statusCode: 200,
              },
            ],
          },
        },
      ],
    },

    {
      name: 'Contribution Flow',
      weight: 20,
      flow: [
        {
          post: {
            url: '/api/auth/login',
            json: {
              email: 'loadtest@example.com',
              password: 'TestPassword123!',
            },
            capture: {
              json: '$.token',
              as: 'authToken',
            },
          },
        },
        {
          post: {
            url: '/api/contributions/submit',
            headers: {
              Authorization: 'Bearer {{ authToken }}',
            },
            json: {
              groupId: '{{ groupId }}',
              amount: '{{ $randomNumber(100, 5000) }}',
              paymentMethod: 'mobile_money',
              phone: '+254712345678',
            },
            expect: [
              {
                statusCode: 201,
              },
            ],
            capture: {
              json: '$.transactionId',
              as: 'contributionId',
            },
          },
        },
        {
          get: {
            url: '/api/contributions/{{ contributionId }}',
            headers: {
              Authorization: 'Bearer {{ authToken }}',
            },
            expect: [
              {
                statusCode: 200,
              },
            ],
          },
        },
        {
          get: {
            url: '/api/contributions?page=1&limit=10',
            headers: {
              Authorization: 'Bearer {{ authToken }}',
            },
            expect: [
              {
                statusCode: 200,
              },
            ],
          },
        },
      ],
    },

    {
      name: 'Payment Processing',
      weight: 15,
      flow: [
        {
          post: {
            url: '/api/auth/login',
            json: {
              email: 'loadtest@example.com',
              password: 'TestPassword123!',
            },
            capture: {
              json: '$.token',
              as: 'authToken',
            },
          },
        },
        {
          post: {
            url: '/api/payments/initiate',
            headers: {
              Authorization: 'Bearer {{ authToken }}',
            },
            json: {
              phone: '+254712345678',
              amount: '{{ $randomNumber(100, 10000) }}',
              provider: 'mpesa',
              description: 'Load test payment',
            },
            expect: [
              {
                statusCode: 200,
              },
              {
                statusCode: 201,
              },
            ],
            capture: {
              json: '$.transactionId',
              as: 'paymentId',
            },
          },
        },
        {
          think: 3,
        },
        {
          post: {
            url: '/api/payments/confirm/{{ paymentId }}',
            headers: {
              Authorization: 'Bearer {{ authToken }}',
            },
            json: {
              confirmationCode: 'test-code',
            },
            expect: [
              {
                statusCode: 200,
              },
            ],
          },
        },
      ],
    },

    {
      name: 'Loan Operations',
      weight: 15,
      flow: [
        {
          post: {
            url: '/api/auth/login',
            json: {
              email: 'loadtest@example.com',
              password: 'TestPassword123!',
            },
            capture: {
              json: '$.token',
              as: 'authToken',
            },
          },
        },
        {
          post: {
            url: '/api/loans/request',
            headers: {
              Authorization: 'Bearer {{ authToken }}',
            },
            json: {
              groupId: '{{ groupId }}',
              amount: '{{ $randomNumber(1000, 10000) }}',
              purpose: 'Load test loan request',
              repaymentPeriod: 12,
            },
            expect: [
              {
                statusCode: 201,
              },
            ],
            capture: {
              json: '$.loanId',
              as: 'loanId',
            },
          },
        },
        {
          get: {
            url: '/api/loans/{{ loanId }}',
            headers: {
              Authorization: 'Bearer {{ authToken }}',
            },
            expect: [
              {
                statusCode: 200,
              },
            ],
          },
        },
        {
          get: {
            url: '/api/loans?status=pending&page=1',
            headers: {
              Authorization: 'Bearer {{ authToken }}',
            },
            expect: [
              {
                statusCode: 200,
              },
            ],
          },
        },
      ],
    },

    {
      name: 'Chat Operations',
      weight: 10,
      flow: [
        {
          post: {
            url: '/api/auth/login',
            json: {
              email: 'loadtest@example.com',
              password: 'TestPassword123!',
            },
            capture: {
              json: '$.token',
              as: 'authToken',
            },
          },
        },
        {
          post: {
            url: '/api/chats/send',
            headers: {
              Authorization: 'Bearer {{ authToken }}',
            },
            json: {
              groupId: '{{ groupId }}',
              message: 'Load test message {{ $randomString(20) }}',
            },
            expect: [
              {
                statusCode: 201,
              },
            ],
          },
        },
        {
          get: {
            url: '/api/chats/group/{{ groupId }}?limit=20',
            headers: {
              Authorization: 'Bearer {{ authToken }}',
            },
            expect: [
              {
                statusCode: 200,
              },
            ],
          },
        },
      ],
    },

    {
      name: 'Dashboard & Analytics',
      weight: 15,
      flow: [
        {
          post: {
            url: '/api/auth/login',
            json: {
              email: 'loadtest@example.com',
              password: 'TestPassword123!',
            },
            capture: {
              json: '$.token',
              as: 'authToken',
            },
          },
        },
        {
          get: {
            url: '/api/dashboard/summary',
            headers: {
              Authorization: 'Bearer {{ authToken }}',
            },
            expect: [
              {
                statusCode: 200,
              },
            ],
          },
        },
        {
          get: {
            url: '/api/analytics/group/{{ groupId }}',
            headers: {
              Authorization: 'Bearer {{ authToken }}',
            },
            expect: [
              {
                statusCode: 200,
              },
            ],
          },
        },
        {
          get: {
            url: '/api/statistics/user/contributions',
            headers: {
              Authorization: 'Bearer {{ authToken }}',
            },
            expect: [
              {
                statusCode: 200,
              },
            ],
          },
        },
      ],
    },
  ],
};
