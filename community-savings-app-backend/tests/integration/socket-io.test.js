/**
 * Socket.IO Integration Tests
 * ============================================================================
 * Tests for real-time Socket.IO event handling and communication
 */

const io = require('socket.io-client');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

describe('Socket.IO Events', () => {
  const SERVER_URL = 'http://localhost:5000';
  let socket;
  let testToken;
  let testUserId;

  beforeAll(async () => {
    // Ensure MongoDB connection
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost/test');
    }

    // Create a test JWT token
    testUserId = new mongoose.Types.ObjectId();
    testToken = jwt.sign(
      { userId: testUserId, id: testUserId },
      process.env.JWT_SECRET || 'test-secret'
    );
  });

  afterAll(async () => {
    if (socket && socket.connected) {
      socket.disconnect();
    }
  });

  describe('Connection', () => {
    it('should connect with valid token', (done) => {
      socket = io(SERVER_URL, {
        auth: { token: testToken },
        reconnection: false
      });

      socket.on('connect', () => {
        expect(socket.connected).toBe(true);
        done();
      });

      socket.on('connect_error', (error) => {
        done(error);
      });
    });

    it('should disconnect gracefully', (done) => {
      socket.on('disconnect', () => {
        expect(socket.connected).toBe(false);
        done();
      });

      socket.disconnect();
    });

    it('should reject connection without token', (done) => {
      const unauthSocket = io(SERVER_URL, {
        reconnection: false
      });

      unauthSocket.on('connect_error', (error) => {
        expect(error).toBeTruthy();
        expect(error.message).toMatch(/authentication/i);
        unauthSocket.disconnect();
        done();
      });
    });
  });

  describe('Chat Events', () => {
    beforeAll((done) => {
      socket = io(SERVER_URL, {
        auth: { token: testToken },
        reconnection: false
      });

      socket.on('connect', done);
      socket.on('connect_error', done);
    });

    it('should subscribe to chat room', (done) => {
      const groupId = 'test-group-1';
      socket.emit('chat:subscribe', groupId);

      // Check if room subscription was successful
      setTimeout(() => {
        expect(socket.rooms).toContain(`chat:${groupId}`);
        done();
      }, 100);
    });

    it('should send and receive chat messages', (done) => {
      socket.on('chat:message-received', (data) => {
        expect(data).toHaveProperty('message');
        expect(data).toHaveProperty('timestamp');
        done();
      });

      socket.emit('chat:message', {
        groupId: 'test-group-1',
        message: 'Hello, this is a test message!'
      });
    });

    it('should handle typing indicators', (done) => {
      socket.on('chat:user-typing', (data) => {
        expect(data).toHaveProperty('userId');
        expect(data).toHaveProperty('timestamp');
        done();
      });

      socket.emit('chat:typing', { groupId: 'test-group-1' });
    });

    it('should handle stopped typing', (done) => {
      socket.on('chat:user-stopped-typing', (data) => {
        expect(data).toHaveProperty('userId');
        done();
      });

      socket.emit('chat:stopped-typing', { groupId: 'test-group-1' });
    });

    it('should unsubscribe from chat room', (done) => {
      const groupId = 'test-group-1';
      socket.emit('chat:unsubscribe', groupId);

      setTimeout(() => {
        expect(socket.rooms).not.toContain(`chat:${groupId}`);
        done();
      }, 100);
    });

    it('should reject empty messages', (done) => {
      socket.on('chat:error', (data) => {
        expect(data).toHaveProperty('error');
        done();
      });

      socket.emit('chat:message', {
        groupId: 'test-group-1',
        message: '   ' // only whitespace
      });
    });
  });

  describe('Notifications', () => {
    beforeAll((done) => {
      socket = io(SERVER_URL, {
        auth: { token: testToken },
        reconnection: false
      });

      socket.on('connect', done);
      socket.on('connect_error', done);
    });

    it('should subscribe to group notifications', (done) => {
      const groupId = 'test-group-2';
      socket.emit('notifications:subscribe', groupId);

      setTimeout(() => {
        expect(socket.rooms).toContain(`notifications:${groupId}`);
        done();
      }, 100);
    });

    it('should receive notifications', (done) => {
      socket.on('notification:received', (data) => {
        expect(data).toHaveProperty('type');
        expect(data).toHaveProperty('data');
        expect(data).toHaveProperty('timestamp');
        done();
      });

      // This would normally come from the server
      socket.emit('notification:test', { test: true });
    });

    it('should unsubscribe from notifications', (done) => {
      const groupId = 'test-group-2';
      socket.emit('notifications:unsubscribe', groupId);

      setTimeout(() => {
        expect(socket.rooms).not.toContain(`notifications:${groupId}`);
        done();
      }, 100);
    });
  });

  describe('Loans Updates', () => {
    beforeAll((done) => {
      socket = io(SERVER_URL, {
        auth: { token: testToken },
        reconnection: false
      });

      socket.on('connect', done);
      socket.on('connect_error', done);
    });

    it('should subscribe to loan updates', (done) => {
      const groupId = 'test-group-3';
      socket.emit('loans:subscribe', groupId);

      setTimeout(() => {
        expect(socket.rooms).toContain(`loans:${groupId}`);
        done();
      }, 100);
    });

    it('should receive loan updates', (done) => {
      socket.on('loan:updated', (data) => {
        expect(data).toHaveProperty('timestamp');
        done();
      });

      socket.emit('loan:test-update', {});
    });

    it('should unsubscribe from loan updates', (done) => {
      const groupId = 'test-group-3';
      socket.emit('loans:unsubscribe', groupId);

      setTimeout(() => {
        expect(socket.rooms).not.toContain(`loans:${groupId}`);
        done();
      }, 100);
    });
  });

  describe('Contributions Updates', () => {
    beforeAll((done) => {
      socket = io(SERVER_URL, {
        auth: { token: testToken },
        reconnection: false
      });

      socket.on('connect', done);
      socket.on('connect_error', done);
    });

    it('should subscribe to contribution updates', (done) => {
      const groupId = 'test-group-4';
      socket.emit('contributions:subscribe', groupId);

      setTimeout(() => {
        expect(socket.rooms).toContain(`contributions:${groupId}`);
        done();
      }, 100);
    });

    it('should receive contribution updates', (done) => {
      socket.on('contribution:updated', (data) => {
        expect(data).toHaveProperty('timestamp');
        done();
      });

      socket.emit('contribution:test-update', {});
    });

    it('should unsubscribe from contributions', (done) => {
      const groupId = 'test-group-4';
      socket.emit('contributions:unsubscribe', groupId);

      setTimeout(() => {
        expect(socket.rooms).not.toContain(`contributions:${groupId}`);
        done();
      }, 100);
    });
  });

  describe('Presence Tracking', () => {
    beforeAll((done) => {
      socket = io(SERVER_URL, {
        auth: { token: testToken },
        reconnection: false
      });

      socket.on('connect', done);
      socket.on('connect_error', done);
    });

    it('should update presence status', (done) => {
      socket.on('presence:updated', (data) => {
        expect(data).toHaveProperty('userId');
        expect(data).toHaveProperty('status');
        expect(['online', 'away', 'offline', 'busy']).toContain(data.status);
        done();
      });

      socket.emit('presence:status', 'online');
    });

    it('should handle multiple presence statuses', (done) => {
      const statuses = ['online', 'away', 'busy'];
      let received = 0;

      socket.on('presence:updated', (data) => {
        received++;
        if (received === statuses.length) {
          done();
        }
      });

      statuses.forEach(status => {
        socket.emit('presence:status', status);
      });
    });

    it('should reject invalid presence status', (done) => {
      const initialRoomCount = Object.keys(socket.rooms).length;

      socket.emit('presence:status', 'invalid-status');

      setTimeout(() => {
        // Should not add any new rooms for invalid status
        expect(Object.keys(socket.rooms).length).toBe(initialRoomCount);
        done();
      }, 100);
    });
  });

  describe('Heartbeat', () => {
    beforeAll((done) => {
      socket = io(SERVER_URL, {
        auth: { token: testToken },
        reconnection: false
      });

      socket.on('connect', done);
      socket.on('connect_error', done);
    });

    it('should respond to heartbeat', (done) => {
      socket.on('heartbeat-ack', (data) => {
        expect(data).toHaveProperty('timestamp');
        done();
      });

      socket.emit('heartbeat');
    });
  });
});

module.exports = {};
