# API Documentation

## Base URL
```
http://localhost:5000/api
```

## Authentication
All protected endpoints require the token in the request header:
```
x-auth-token: <jwt-token>
```

---

## Auth Endpoints

### Register New User
```
POST /auth/register
Content-Type: application/json

Request:
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123"
}

Response (201):
{
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "john@example.com",
    "name": "John Doe",
    "role": "user"
  }
}

Validation Errors (400):
{
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Please provide a valid email"
    },
    {
      "field": "password",
      "message": "Password must contain at least one uppercase letter..."
    }
  ]
}
```

### Login
```
POST /auth/login
Content-Type: application/json

Request:
{
  "email": "john@example.com",
  "password": "SecurePass123"
}

Response (200):
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "john@example.com",
    "name": "John Doe",
    "role": "user"
  }
}

Error (401):
{
  "message": "Invalid credentials"
}
```

### Get Current User
```
GET /auth/me
x-auth-token: <token>

Response (200):
{
  "id": "507f1f77bcf86cd799439011",
  "email": "john@example.com",
  "name": "John Doe",
  "role": "user",
  "phone": "+1234567890",
  "profile": {
    "address": "123 Main St",
    "city": "New York",
    "country": "USA",
    "occupation": "Engineer"
  },
  "bonus": 0,
  "referralCode": "REF123ABC",
  "isVerified": false,
  "lastLogin": "2025-12-03T10:30:00Z"
}

Error (401):
{
  "message": "Token has expired"
}
```

### Refresh Access Token
```
POST /auth/refresh
Cookie: refreshToken=<refresh_token>

Response (200):
{
  "message": "Token refreshed successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

Error (401):
{
  "message": "Missing refresh token"
}

Error (403):
{
  "message": "Invalid or expired refresh token"
}
```

### Logout
```
POST /auth/logout

Response (200):
{
  "message": "Logged out successfully"
}
```

---

## Group Endpoints

### Create Group
```
POST /groups
x-auth-token: <token>
Content-Type: application/json

Request:
{
  "name": "Savings Circle 2025",
  "description": "Weekly savings group for community members"
}

Response (201):
{
  "message": "Group created successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "name": "Savings Circle 2025",
    "description": "Weekly savings group...",
    "members": ["507f1f77bcf86cd799439011"],
    "createdBy": "507f1f77bcf86cd799439011",
    "createdAt": "2025-12-03T10:00:00Z",
    "updatedAt": "2025-12-03T10:00:00Z"
  }
}
```

### List User's Groups
```
GET /groups?page=1&limit=10
x-auth-token: <token>

Response (200):
{
  "message": "Groups retrieved successfully",
  "data": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "name": "Savings Circle 2025",
      "description": "Weekly savings group...",
      "members": ["507f1f77bcf86cd799439011"],
      "createdBy": {
        "_id": "507f1f77bcf86cd799439011",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "createdAt": "2025-12-03T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "pages": 1
  }
}
```

### Get Group Details
```
GET /groups/:groupId
x-auth-token: <token>

Response (200):
{
  "message": "Group retrieved successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "name": "Savings Circle 2025",
    "description": "Weekly savings group...",
    "members": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "name": "John Doe",
        "email": "john@example.com"
      }
    ],
    "createdBy": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "createdAt": "2025-12-03T10:00:00Z"
  }
}

Error (403):
{
  "message": "Not authorized to view this group"
}

Error (404):
{
  "message": "Group not found"
}
```

### Join Group
```
POST /groups/:groupId/join
x-auth-token: <token>

Response (200):
{
  "message": "Successfully joined group",
  "data": { ... }
}

Error (400):
{
  "message": "You are already a member of this group"
}
```

### Leave Group
```
POST /groups/:groupId/leave
x-auth-token: <token>

Response (200):
{
  "message": "Successfully left the group",
  "data": { ... }
}

Error (403):
{
  "message": "Group creator cannot leave the group"
}
```

---

## Contribution Endpoints

### Add Contribution
```
POST /contributions
x-auth-token: <token>
Content-Type: application/json

Request:
{
  "groupId": "507f1f77bcf86cd799439012",
  "amount": 5000
}

Response (201):
{
  "message": "Contribution added successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439013",
    "user": "507f1f77bcf86cd799439011",
    "group": "507f1f77bcf86cd799439012",
    "amount": 5000,
    "createdAt": "2025-12-03T10:30:00Z"
  }
}

Error (403):
{
  "message": "You are not a member of this group"
}
```

### Get Group Contributions
```
GET /contributions/group/:groupId?page=1&limit=20
x-auth-token: <token>

Response (200):
{
  "message": "Group contributions retrieved successfully",
  "data": [
    {
      "_id": "507f1f77bcf86cd799439013",
      "user": {
        "_id": "507f1f77bcf86cd799439011",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "group": "507f1f77bcf86cd799439012",
      "amount": 5000,
      "createdAt": "2025-12-03T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "pages": 1
  }
}
```

### Get User Contributions
```
GET /contributions/user?page=1&limit=20
x-auth-token: <token>

Response (200):
{
  "message": "User contributions retrieved successfully",
  "data": [
    {
      "_id": "507f1f77bcf86cd799439013",
      "user": "507f1f77bcf86cd799439011",
      "group": {
        "_id": "507f1f77bcf86cd799439012",
        "name": "Savings Circle 2025"
      },
      "amount": 5000,
      "createdAt": "2025-12-03T10:30:00Z"
    }
  ],
  "pagination": { ... }
}
```

### Get Group Statistics
```
GET /contributions/group/:groupId/stats
x-auth-token: <token>

Response (200):
{
  "message": "Group statistics retrieved successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "totalAmount": 50000,
    "contributionCount": 10,
    "avgContribution": 5000
  }
}
```

---

## Error Responses

### Format
All errors follow this format:
```json
{
  "errorId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "message": "Error description",
  "details": "Additional context (development only)"
}
```

### Common Error Codes
| Code | Meaning | Solution |
|------|---------|----------|
| 400 | Validation failed | Check request data format |
| 401 | Unauthorized | Add x-auth-token header |
| 403 | Forbidden | User doesn't have permission |
| 404 | Not found | Check resource ID |
| 500 | Server error | Check errorId for logs |

---

## Rate Limiting
- **Global**: 100 requests per 15 minutes per IP
- **Response Header**: `X-RateLimit-Remaining`

---

## Token Expiry
- **Access Token**: 15 minutes
- **Refresh Token**: 7 days

When access token expires, use the refresh endpoint to get a new one.

---

## Validation Rules

### Password
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number

### Email
- Valid email format
- Unique in system

### Amount
- Greater than 0
- Numeric value

### Group Name
- 3-100 characters
- Unique in system

---

## Testing with cURL

### Register
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "SecurePass123"
  }' \
  -c cookies.txt
```

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123"
  }' \
  -c cookies.txt
```

### Get Current User
```bash
TOKEN="<token_from_login>"
curl -X GET http://localhost:5000/api/auth/me \
  -H "x-auth-token: $TOKEN"
```

### Create Group
```bash
TOKEN="<token>"
curl -X POST http://localhost:5000/api/groups \
  -H "Content-Type: application/json" \
  -H "x-auth-token: $TOKEN" \
  -d '{
    "name": "Savings Circle 2025",
    "description": "Weekly savings group"
  }'
```

---

**For more details, check the review document: CODE_REVIEW_AND_IMPROVEMENTS.md**
