/**
 * tests/integration/chat.test.js
 *
 * Integration tests for real-time chat functionality.
 * Tests conversations, messages, read receipts, moderation, and soft deletes.
 *
 * Coverage: ChatService, ChatController
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const ChatService = require('../../services/chatService');

describe('Chat Integration Tests', () => {
  let user1;
  let user2;
  let user1Token;
  let user2Token;
  let chatService;
  let testConversationId;

  beforeAll(async () => {
    chatService = app.locals.chatService || new ChatService();
  });

  beforeEach(async () => {
    const User = require('../../models/User');
    const jwt = require('jsonwebtoken');

    // Create two users
    user1 = await User.create({
      name: 'User One',
      email: `user1-${Date.now()}@example.com`,
      password: 'hashedPassword123',
    });

    user2 = await User.create({
      name: 'User Two',
      email: `user2-${Date.now()}@example.com`,
      password: 'hashedPassword123',
    });

    user1Token = jwt.sign(
      { _id: user1._id, email: user1.email },
      process.env.JWT_SECRET || 'test-secret'
    );

    user2Token = jwt.sign(
      { _id: user2._id, email: user2.email },
      process.env.JWT_SECRET || 'test-secret'
    );
  });

  afterEach(async () => {
    const User = require('../../models/User');
    const Conversation = require('../../models/Conversation');
    const ChatMessage = require('../../models/ChatMessage');

    await User.deleteMany({});
    await Conversation.deleteMany({});
    await ChatMessage.deleteMany({});
  });

  describe('POST /api/chat/conversations - Create Conversation', () => {
    test('should create DM conversation idempotently', async () => {
      const res = await request(app)
        .post('/api/chat/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          type: 'dm',
          participantIds: [user2._id.toString()],
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('_id');
      expect(res.body.data.type).toBe('dm');

      testConversationId = res.body.data._id;
    });

    test('should return same DM for same participants', async () => {
      // Create first
      const res1 = await request(app)
        .post('/api/chat/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          type: 'dm',
          participantIds: [user2._id.toString()],
        });

      // Create again
      const res2 = await request(app)
        .post('/api/chat/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          type: 'dm',
          participantIds: [user2._id.toString()],
        });

      expect(res1.body.data._id).toBe(res2.body.data._id);
    });

    test('should create group conversation', async () => {
      const res = await request(app)
        .post('/api/chat/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          type: 'group',
          participantIds: [user2._id.toString()],
          name: 'Test Group',
          description: 'A test group conversation',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.type).toBe('group');
      expect(res.body.data.name).toBe('Test Group');
    });

    test('should reject group conversation without name', async () => {
      const res = await request(app)
        .post('/api/chat/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          type: 'group',
          participantIds: [user2._id.toString()],
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/chat/conversations - List Conversations', () => {
    beforeEach(async () => {
      const res = await request(app)
        .post('/api/chat/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          type: 'dm',
          participantIds: [user2._id.toString()],
        });
      testConversationId = res.body.data._id;
    });

    test('should list user conversations with pagination', async () => {
      const res = await request(app)
        .get('/api/chat/conversations?page=1&limit=20')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toHaveProperty('page');
      expect(res.body.pagination).toHaveProperty('limit');
    });
  });

  describe('POST /api/chat/conversations/:id/messages - Send Message', () => {
    beforeEach(async () => {
      const res = await request(app)
        .post('/api/chat/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          type: 'dm',
          participantIds: [user2._id.toString()],
        });
      testConversationId = res.body.data._id;
    });

    test('should send message to conversation', async () => {
      const res = await request(app)
        .post(`/api/chat/conversations/${testConversationId}/messages`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          content: 'Hello, this is a test message!',
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('_id');
      expect(res.body.data.content).toBe('Hello, this is a test message!');
      expect(res.body.data.sender._id.toString()).toBe(user1._id.toString());
    });

    test('should validate message length', async () => {
      const res = await request(app)
        .post(`/api/chat/conversations/${testConversationId}/messages`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          content: 'x'.repeat(5001), // Exceeds max
        });

      expect(res.status).toBe(400);
    });

    test('should reject empty message', async () => {
      const res = await request(app)
        .post(`/api/chat/conversations/${testConversationId}/messages`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          content: '',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/chat/conversations/:id/messages - Get Messages', () => {
    beforeEach(async () => {
      const res = await request(app)
        .post('/api/chat/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          type: 'dm',
          participantIds: [user2._id.toString()],
        });
      testConversationId = res.body.data._id;

      // Send a message
      await request(app)
        .post(`/api/chat/conversations/${testConversationId}/messages`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          content: 'Test message',
        });
    });

    test('should retrieve messages with pagination', async () => {
      const res = await request(app)
        .get(`/api/chat/conversations/${testConversationId}/messages?page=1&limit=50`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toHaveProperty('total');
    });
  });

  describe('POST /api/chat/conversations/:id/messages/:id/read - Mark as Read', () => {
    let messageId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/chat/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          type: 'dm',
          participantIds: [user2._id.toString()],
        });
      testConversationId = res.body.data._id;

      // Send message
      const msgRes = await request(app)
        .post(`/api/chat/conversations/${testConversationId}/messages`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          content: 'Test message for read receipt',
        });
      messageId = msgRes.body.data._id;
    });

    test('should mark message as read', async () => {
      const res = await request(app)
        .post(`/api/chat/conversations/${testConversationId}/messages/${messageId}/read`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.readBy).toBeDefined();
    });
  });

  describe('PUT /api/chat/conversations/:id/messages/:id - Edit Message', () => {
    let messageId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/chat/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          type: 'dm',
          participantIds: [user2._id.toString()],
        });
      testConversationId = res.body.data._id;

      // Send message
      const msgRes = await request(app)
        .post(`/api/chat/conversations/${testConversationId}/messages`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          content: 'Original message',
        });
      messageId = msgRes.body.data._id;
    });

    test('should edit own message', async () => {
      const res = await request(app)
        .put(`/api/chat/conversations/${testConversationId}/messages/${messageId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          content: 'Edited message',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.content).toBe('Edited message');
    });

    test('should prevent editing others messages', async () => {
      const res = await request(app)
        .put(`/api/chat/conversations/${testConversationId}/messages/${messageId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          content: 'Hacked message',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/chat/conversations/:id/messages/:id - Delete Message', () => {
    let messageId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/chat/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          type: 'dm',
          participantIds: [user2._id.toString()],
        });
      testConversationId = res.body.data._id;

      const msgRes = await request(app)
        .post(`/api/chat/conversations/${testConversationId}/messages`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          content: 'Message to delete',
        });
      messageId = msgRes.body.data._id;
    });

    test('should soft-delete message', async () => {
      const res = await request(app)
        .delete(`/api/chat/conversations/${testConversationId}/messages/${messageId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.deletedAt).toBeDefined();
      expect(res.body.data.deletedBy).toBeDefined();
    });

    test('should prevent unauthorized deletion', async () => {
      const res = await request(app)
        .delete(`/api/chat/conversations/${testConversationId}/messages/${messageId}`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/chat/conversations/:id/archive - Archive Conversation', () => {
    beforeEach(async () => {
      const res = await request(app)
        .post('/api/chat/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          type: 'dm',
          participantIds: [user2._id.toString()],
        });
      testConversationId = res.body.data._id;
    });

    test('should archive conversation', async () => {
      const res = await request(app)
        .post(`/api/chat/conversations/${testConversationId}/archive`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.archivedBy).toContain(user1._id.toString());
    });
  });

  describe('GET /api/chat/unread - Get Unread Counts', () => {
    beforeEach(async () => {
      const res = await request(app)
        .post('/api/chat/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          type: 'dm',
          participantIds: [user2._id.toString()],
        });
      testConversationId = res.body.data._id;

      // User1 sends message to user2
      await request(app)
        .post(`/api/chat/conversations/${testConversationId}/messages`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          content: 'Unread message',
        });
    });

    test('should return unread count per conversation', async () => {
      const res = await request(app)
        .get('/api/chat/unread')
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/chat/conversations/:id/search - Search Messages', () => {
    beforeEach(async () => {
      const res = await request(app)
        .post('/api/chat/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          type: 'dm',
          participantIds: [user2._id.toString()],
        });
      testConversationId = res.body.data._id;

      // Send multiple messages
      const messages = [
        'Hello, how are you?',
        'I am doing great!',
        'Let me search for hello',
      ];

      for (const msg of messages) {
        await request(app)
          .post(`/api/chat/conversations/${testConversationId}/messages`)
          .set('Authorization', `Bearer ${user1Token}`)
          .send({ content: msg });
      }
    });

    test('should search messages in conversation', async () => {
      const res = await request(app)
        .get(`/api/chat/conversations/${testConversationId}/search?q=hello`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      // Should find messages containing "hello"
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    test('should require search query', async () => {
      const res = await request(app)
        .get(`/api/chat/conversations/${testConversationId}/search`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(400);
    });
  });
});
