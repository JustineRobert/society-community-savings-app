# Backend API Implementation Guide

## Help Center, FAQ & Community Forum

This document outlines the backend API requirements for the Help Center, FAQ, and Community Forum features.

---

## Table of Contents

1. [Database Schema](#database-schema)
2. [API Endpoints](#api-endpoints)
3. [Request/Response Examples](#requestresponse-examples)
4. [Error Handling](#error-handling)
5. [Authentication & Authorization](#authentication--authorization)
6. [Rate Limiting](#rate-limiting)

---

## Database Schema

### Help Articles Table

```sql
CREATE TABLE help_articles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  content LONGTEXT NOT NULL,
  category VARCHAR(100) NOT NULL,
  author_id INT NOT NULL,
  views INT DEFAULT 0,
  helpful_count INT DEFAULT 0,
  unhelpful_count INT DEFAULT 0,
  is_featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (author_id) REFERENCES users(id),
  INDEX idx_category (category),
  INDEX idx_created_at (created_at)
);
```

### FAQ Table

```sql
CREATE TABLE faqs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  question VARCHAR(500) NOT NULL,
  answer LONGTEXT NOT NULL,
  category VARCHAR(100) NOT NULL,
  author_id INT NOT NULL,
  views INT DEFAULT 0,
  helpful_count INT DEFAULT 0,
  unhelpful_count INT DEFAULT 0,
  is_published BOOLEAN DEFAULT TRUE,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (author_id) REFERENCES users(id),
  INDEX idx_category (category),
  INDEX idx_display_order (display_order)
);
```

### Forum Topics Table

```sql
CREATE TABLE forum_topics (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  content LONGTEXT NOT NULL,
  category VARCHAR(100) NOT NULL,
  author_id INT NOT NULL,
  views INT DEFAULT 0,
  replies_count INT DEFAULT 0,
  is_sticky BOOLEAN DEFAULT FALSE,
  is_locked BOOLEAN DEFAULT FALSE,
  is_solved BOOLEAN DEFAULT FALSE,
  solution_reply_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_reply_at TIMESTAMP NULL,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (author_id) REFERENCES users(id),
  FOREIGN KEY (solution_reply_id) REFERENCES forum_replies(id),
  INDEX idx_category (category),
  INDEX idx_created_at (created_at),
  INDEX idx_sticky (is_sticky)
);
```

### Forum Replies Table

```sql
CREATE TABLE forum_replies (
  id INT PRIMARY KEY AUTO_INCREMENT,
  topic_id INT NOT NULL,
  author_id INT NOT NULL,
  content LONGTEXT NOT NULL,
  upvotes INT DEFAULT 0,
  downvotes INT DEFAULT 0,
  is_solution BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (topic_id) REFERENCES forum_topics(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id),
  INDEX idx_topic_id (topic_id),
  INDEX idx_created_at (created_at)
);
```

### Forum Tags Table

```sql
CREATE TABLE forum_tags (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL UNIQUE,
  description VARCHAR(255),
  usage_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_name (name)
);
```

### Forum Topic Tags Junction Table

```sql
CREATE TABLE forum_topic_tags (
  topic_id INT NOT NULL,
  tag_id INT NOT NULL,
  PRIMARY KEY (topic_id, tag_id),
  FOREIGN KEY (topic_id) REFERENCES forum_topics(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES forum_tags(id) ON DELETE CASCADE
);
```

### Helpful Votes Table

```sql
CREATE TABLE helpful_votes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  content_type VARCHAR(50) NOT NULL, -- 'article', 'faq'
  content_id INT NOT NULL,
  vote_type VARCHAR(20) NOT NULL, -- 'helpful', 'unhelpful'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_vote (user_id, content_type, content_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_content (content_type, content_id)
);
```

### Forum Topic Followers Table

```sql
CREATE TABLE forum_topic_followers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  topic_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_follower (user_id, topic_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (topic_id) REFERENCES forum_topics(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
);
```

### Content Reports Table

```sql
CREATE TABLE content_reports (
  id INT PRIMARY KEY AUTO_INCREMENT,
  reporter_id INT NOT NULL,
  content_type VARCHAR(50) NOT NULL, -- 'topic', 'reply', 'article'
  content_id INT NOT NULL,
  reason VARCHAR(255) NOT NULL,
  description LONGTEXT,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'reviewed', 'resolved', 'dismissed'
  resolution_notes LONGTEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL,
  FOREIGN KEY (reporter_id) REFERENCES users(id),
  INDEX idx_status (status),
  INDEX idx_content (content_type, content_id)
);
```

---

## API Endpoints

### Help Center Endpoints

#### Get Articles

```
GET /api/help/articles
Query Parameters:
  - page (default: 1)
  - limit (default: 10)
  - category (optional)
  - sort (default: 'newest', options: 'newest', 'popular', 'trending')

Response:
{
  "articles": [...],
  "total": 150,
  "page": 1,
  "limit": 10,
  "pages": 15
}
```

#### Search Articles

```
GET /api/help/search
Query Parameters:
  - q (required): search query
  - page (default: 1)
  - limit (default: 10)

Response:
{
  "results": [...],
  "query": "password",
  "total": 5
}
```

#### Get Article by ID

```
GET /api/help/articles/:id

Response:
{
  "article": {
    "id": 1,
    "title": "Getting Started",
    "content": "...",
    "category": "basics",
    "views": 250,
    "helpful": 45,
    "unhelpful": 2,
    "relatedArticles": [...]
  }
}
```

#### Get Article Categories

```
GET /api/help/categories

Response:
{
  "categories": [
    {
      "id": 1,
      "name": "basics",
      "count": 10
    },
    ...
  ]
}
```

#### Mark Article Helpful

```
POST /api/help/articles/:id/helpful

Response:
{
  "success": true,
  "message": "Thanks for your feedback!",
  "helpful_count": 46
}
```

#### Get Featured Articles

```
GET /api/help/articles/featured
Query Parameters:
  - limit (default: 6)

Response:
{
  "articles": [...]
}
```

#### Create Article (Admin)

```
POST /api/help/articles
Headers:
  Authorization: Bearer <token>

Request Body:
{
  "title": "New Article",
  "content": "...",
  "category": "basics",
  "isFeatured": false
}

Response:
{
  "article": {...}
}
```

#### Update Article (Admin)

```
PUT /api/help/articles/:id
Headers:
  Authorization: Bearer <token>

Request Body:
{
  "title": "Updated Article",
  ...
}

Response:
{
  "article": {...}
}
```

#### Delete Article (Admin)

```
DELETE /api/help/articles/:id
Headers:
  Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "Article deleted"
}
```

---

### FAQ Endpoints

#### Get FAQs

```
GET /api/faq
Query Parameters:
  - page (default: 1)
  - limit (default: 20)
  - category (optional)
  - sort (default: 'order', options: 'order', 'popular', 'newest')

Response:
{
  "items": [...],
  "total": 50,
  "page": 1
}
```

#### Search FAQs

```
GET /api/faq/search
Query Parameters:
  - q (required): search query
  - limit (default: 20)

Response:
{
  "results": [...]
}
```

#### Get FAQ Categories

```
GET /api/faq/categories

Response:
{
  "categories": [...]
}
```

#### Mark FAQ Helpful

```
POST /api/faq/:id/helpful

Response:
{
  "success": true,
  "helpful_count": 120
}
```

#### Get Popular FAQs

```
GET /api/faq/popular
Query Parameters:
  - limit (default: 5)

Response:
{
  "items": [...]
}
```

#### Create FAQ (Admin)

```
POST /api/faq
Headers:
  Authorization: Bearer <token>

Request Body:
{
  "question": "How to reset password?",
  "answer": "...",
  "category": "account",
  "displayOrder": 1
}

Response:
{
  "item": {...}
}
```

#### Update FAQ (Admin)

```
PUT /api/faq/:id
Headers:
  Authorization: Bearer <token>

Request Body:
{
  "question": "Updated question?",
  ...
}

Response:
{
  "item": {...}
}
```

#### Bulk Import FAQs (Admin)

```
POST /api/faq/bulk-import
Headers:
  Authorization: Bearer <token>
  Content-Type: multipart/form-data

Form Data:
  - file (CSV or JSON file)

Response:
{
  "imported": 50,
  "errors": [],
  "message": "Successfully imported 50 FAQs"
}
```

---

### Forum Endpoints

#### Get Topics

```
GET /api/forum/topics
Query Parameters:
  - page (default: 1)
  - limit (default: 20)
  - sort (default: 'newest', options: 'newest', 'active', 'viewed')
  - category (optional)
  - filter (optional: 'all', 'unanswered', 'solved')

Response:
{
  "topics": [
    {
      "id": 1,
      "title": "How to transfer money?",
      "category": "general",
      "author": {...},
      "replies": 5,
      "views": 250,
      "tags": [],
      "isSticky": false,
      "isSolved": false,
      "lastReply": {...},
      "createdAt": "2024-01-15T10:00:00Z"
    },
    ...
  ],
  "total": 100,
  "page": 1
}
```

#### Get Single Topic

```
GET /api/forum/topics/:id

Response:
{
  "topic": {
    "id": 1,
    "title": "...",
    "content": "...",
    ...
    "replies": [
      {
        "id": 1,
        "author": {...},
        "content": "...",
        "upvotes": 5,
        "downvotes": 0,
        "isSolution": false,
        "createdAt": "2024-01-15T10:05:00Z"
      },
      ...
    ]
  }
}
```

#### Create Topic

```
POST /api/forum/topics
Headers:
  Authorization: Bearer <token>

Request Body:
{
  "title": "How to transfer money?",
  "content": "I want to know...",
  "category": "general",
  "tags": ["transfer", "help"]
}

Response:
{
  "topic": {...}
}
```

#### Update Topic

```
PUT /api/forum/topics/:id
Headers:
  Authorization: Bearer <token>

Request Body:
{
  "title": "Updated title",
  "content": "...",
  "category": "general"
}

Response:
{
  "topic": {...}
}
```

#### Delete Topic

```
DELETE /api/forum/topics/:id
Headers:
  Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "Topic deleted"
}
```

#### Create Reply

```
POST /api/forum/topics/:topicId/replies
Headers:
  Authorization: Bearer <token>

Request Body:
{
  "content": "Here's the solution..."
}

Response:
{
  "reply": {...}
}
```

#### Update Reply

```
PUT /api/forum/topics/:topicId/replies/:replyId
Headers:
  Authorization: Bearer <token>

Request Body:
{
  "content": "Updated reply..."
}

Response:
{
  "reply": {...}
}
```

#### Delete Reply

```
DELETE /api/forum/topics/:topicId/replies/:replyId
Headers:
  Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "Reply deleted"
}
```

#### Mark as Solution

```
POST /api/forum/topics/:topicId/replies/:replyId/mark-solution
Headers:
  Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "Reply marked as solution"
}
```

#### Get Topic Replies

```
GET /api/forum/topics/:topicId/replies
Query Parameters:
  - page (default: 1)
  - limit (default: 20)
  - sort (default: 'newest', options: 'newest', 'oldest', 'helpful')

Response:
{
  "replies": [...],
  "total": 5,
  "page": 1
}
```

#### Vote on Reply

```
POST /api/forum/topics/:topicId/replies/:replyId/vote
Headers:
  Authorization: Bearer <token>

Request Body:
{
  "voteType": "up" or "down"
}

Response:
{
  "success": true,
  "upvotes": 6,
  "downvotes": 0
}
```

#### Mark Sticky

```
POST /api/forum/topics/:id/sticky
Headers:
  Authorization: Bearer <token> (Admin only)

Response:
{
  "success": true,
  "isSticky": true
}
```

#### Lock Topic

```
POST /api/forum/topics/:id/lock
Headers:
  Authorization: Bearer <token> (Admin only)

Response:
{
  "success": true,
  "isLocked": true
}
```

#### Get Forum Categories

```
GET /api/forum/categories

Response:
{
  "categories": [...]
}
```

#### Get Forum Statistics

```
GET /api/forum/stats

Response:
{
  "totalTopics": 100,
  "totalReplies": 500,
  "totalUsers": 50,
  "todayTopics": 5,
  "todayReplies": 25
}
```

#### Search Topics

```
GET /api/forum/search
Query Parameters:
  - q (required): search query
  - category (optional)
  - page (default: 1)
  - limit (default: 20)

Response:
{
  "results": [...]
}
```

#### Get Recent Topics

```
GET /api/forum/topics/recent
Query Parameters:
  - limit (default: 5)

Response:
{
  "topics": [...]
}
```

#### Get Popular Topics

```
GET /api/forum/topics/popular
Query Parameters:
  - limit (default: 5)
  - timeframe (default: 'week', options: 'day', 'week', 'month', 'all')

Response:
{
  "topics": [...]
}
```

#### Follow/Unfollow Topic

```
POST /api/forum/topics/:id/follow
Headers:
  Authorization: Bearer <token>

Response:
{
  "following": true
}
```

#### Report Content

```
POST /api/forum/report
Headers:
  Authorization: Bearer <token>

Request Body:
{
  "contentType": "topic|reply|article",
  "contentId": 1,
  "reason": "spam|offensive|misinformation|other",
  "description": "Detailed description..."
}

Response:
{
  "success": true,
  "reportId": 123,
  "message": "Report submitted"
}
```

#### Get Trending Topics

```
GET /api/forum/topics/trending
Query Parameters:
  - limit (default: 10)
  - timeframe (default: 'week')

Response:
{
  "topics": [...]
}
```

---

## Request/Response Examples

### Example: Get Help Articles Request

```bash
curl -X GET \
  'http://localhost:3001/api/help/articles?page=1&limit=10' \
  -H 'Accept: application/json'
```

### Example: Create Forum Topic Request

```bash
curl -X POST \
  'http://localhost:3001/api/forum/topics' \
  -H 'Authorization: Bearer your_token' \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "How to transfer money?",
    "content": "I want to know how to transfer money between accounts.",
    "category": "general",
    "tags": ["transfer", "help"]
  }'
```

### Example: Search FAQ Request

```bash
curl -X GET \
  'http://localhost:3001/api/faq/search?q=password&limit=20' \
  -H 'Accept: application/json'
```

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {}
  }
}
```

### Common Error Codes

| Code             | HTTP Status | Description              |
| ---------------- | ----------- | ------------------------ |
| NOT_FOUND        | 404         | Resource not found       |
| UNAUTHORIZED     | 401         | Authentication required  |
| FORBIDDEN        | 403         | Insufficient permissions |
| VALIDATION_ERROR | 400         | Invalid request data     |
| DUPLICATE_ENTRY  | 409         | Resource already exists  |
| SERVER_ERROR     | 500         | Internal server error    |

---

## Authentication & Authorization

### Authentication Methods

1. **Bearer Token (JWT)**

   ```
   Authorization: Bearer <token>
   ```

2. **API Key** (for admin operations)
   ```
   X-API-Key: <api_key>
   ```

### Authorization Levels

| Level     | Permissions                                    |
| --------- | ---------------------------------------------- |
| Public    | Read articles, FAQs, forum topics              |
| User      | Create topics, replies, feedback               |
| Moderator | Edit/delete other users' content, lock topics  |
| Admin     | Full CRUD operations, user management, reports |

### Protected Endpoints

Endpoints requiring authentication are marked with `Headers: Authorization: Bearer <token>`

---

## Rate Limiting

### Rate Limit Headers

All responses include:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640000000
```

### Limits

| Endpoint Type    | Limit | Window   |
| ---------------- | ----- | -------- |
| Read operations  | 1000  | Per hour |
| Write operations | 100   | Per hour |
| Search           | 200   | Per hour |
| Admin operations | 50    | Per hour |

### Rate Limit Response

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "retryAfter": 3600
  }
}
```

---

## Implementation Notes

1. **Search Optimization**: Use full-text search indexes for better performance
2. **Caching**: Cache popular articles, FAQs, and trending topics
3. **Pagination**: Always implement pagination for list endpoints
4. **Soft Deletes**: Use soft deletes to preserve data integrity
5. **Timestamps**: Track created_at and updated_at for all resources
6. **Audit Logging**: Log all admin operations for compliance

---

**Last Updated:** January 2024
**Version:** 1.0.0
