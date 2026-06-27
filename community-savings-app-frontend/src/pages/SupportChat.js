// ============================================================================
// TITech Community Capital – Support Chat Page
// File: frontend/src/pages/SupportChat.jsx
// Production-grade
// ============================================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import logger from '../../utils/logger';
import Spinner from '../components/ui/Spinner';
import MessageBubble from '../components/chat/MessageBubble';
import AttachmentPreview from '../components/ui/AttachmentPreview';
import useDebouncedCallback from '../hooks/useDebouncedCallback'; // optional helper; fallback included below

// Fallback debounced hook if your repo doesn't include one
function defaultUseDebouncedCallback(fn, wait = 300) {
  const timeoutRef = useRef(null);
  const callback = useCallback(
    (...args) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => fn(...args), wait);
    },
    [fn, wait]
  );
  useEffect(() => () => clearTimeout(timeoutRef.current), []);
  return callback;
}

const useDebounce = useDebouncedCallback || defaultUseDebouncedCallback;

const WS_RECONNECT_BASE_MS = 1000;
const WS_RECONNECT_MAX_MS = 30000;
const MAX_OFFLINE_QUEUE = 200;

/**
 * SupportChat
 *
 * - Real-time chat UI with WebSocket + REST fallback
 * - Reconnect/backoff, optimistic UI, offline queue, file attachments
 * - Accessible form controls and keyboard shortcuts
 * - Defensive error handling and telemetry hooks
 *
 * Usage:
 * <SupportChat conversationId="support-general" />
 */
export default function SupportChat({ conversationId = 'support-general', title = 'Support' }) {
  const { user, token } = useAuth() ?? {};
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [error, setError] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);

  const wsRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const offlineQueueRef = useRef([]);
  const mountedRef = useRef(true);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const lastSeenRef = useRef(Date.now());

  // Build WS URL from env or fallback to api base
  const wsUrl = useMemo(() => {
    const base = process.env.REACT_APP_WS_URL || process.env.REACT_APP_API_WS || window.location.origin.replace(/^http/, 'ws');
    // include conversation id and token as query params for auth (server should validate)
    const q = new URLSearchParams({ conversationId, token: token || '' }).toString();
    return `${base.replace(/\/$/, '')}/ws/support?${q}`;
  }, [conversationId, token]);

  // Scroll to bottom helper
  const scrollToBottom = useCallback((behavior = 'smooth') => {
    try {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    } catch (err) {
      // ignore
    }
  }, []);

  // Append message safely (dedupe by id)
  const appendMessage = useCallback((msg) => {
    setMessages((prev) => {
      if (!msg) return prev;
      if (prev.some((m) => m.id && msg.id && m.id === msg.id)) return prev;
      return [...prev, msg].slice(-1000); // keep bounded history
    });
  }, []);

  // Replace optimistic message with server ack
  const replaceOptimistic = useCallback((tempId, serverMsg) => {
    setMessages((prev) => prev.map((m) => (m.id === tempId ? serverMsg : m)));
  }, []);

  // Remove optimistic message on failure
  const removeOptimistic = useCallback((tempId) => {
    setMessages((prev) => prev.filter((m) => m.id !== tempId));
  }, []);

  // Send message via WS or REST fallback
  const sendMessage = useCallback(
    async ({ text, attachments: atts = [] }) => {
      if (!text && (!atts || atts.length === 0)) return null;
      const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimistic = {
        id: tempId,
        conversationId,
        text,
        attachments: atts,
        from: { id: user?.id ?? 'me', name: user?.name ?? 'You' },
        status: 'sending',
        createdAt: new Date().toISOString(),
      };
      appendMessage(optimistic);

      const payload = { conversationId, text, attachments: atts };

      // Try WebSocket first
      try {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'message.create', payload }));
          return tempId;
        }
      } catch (err) {
        logger?.warn?.('WS send failed, falling back to REST', { error: err?.message });
      }

      // If WS not available, queue and attempt REST
      try {
        // Queue for offline send if disconnected
        if (!connected) {
          offlineQueueRef.current.push({ payload, tempId });
          if (offlineQueueRef.current.length > MAX_OFFLINE_QUEUE) {
            offlineQueueRef.current.shift();
          }
          setError('You are offline — message queued');
          return tempId;
        }

        // REST fallback
        const resp = await api.post(
          `/api/support/${conversationId}/messages`,
          payload,
          { timeout: 20000 }
        );
        const serverMsg = resp?.data;
        if (serverMsg) {
          replaceOptimistic(tempId, serverMsg);
        } else {
          removeOptimistic(tempId);
        }
        return tempId;
      } catch (err) {
        removeOptimistic(tempId);
        setError('Failed to send message');
        logger?.error?.('sendMessage REST failed', { error: err?.message });
        return null;
      }
    },
    [appendMessage, conversationId, connected, replaceOptimistic, removeOptimistic, user]
  );

  // Process offline queue when reconnected
  const flushOfflineQueue = useCallback(async () => {
    if (!offlineQueueRef.current.length) return;
    const queue = offlineQueueRef.current.splice(0, offlineQueueRef.current.length);
    for (const item of queue) {
      try {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'message.create', payload: item.payload }));
        } else {
          await api.post(`/api/support/${conversationId}/messages`, item.payload);
        }
      } catch (err) {
        logger?.warn?.('Failed to flush offline message', { error: err?.message });
        // re-queue for later
        offlineQueueRef.current.unshift(item);
        break;
      }
    }
  }, [conversationId]);

  // Handle incoming WS messages
  const handleWsMessage = useCallback(
    (evt) => {
      try {
        const data = typeof evt.data === 'string' ? JSON.parse(evt.data) : evt.data;
        if (!data || !data.type) return;

        switch (data.type) {
          case 'message.created':
            appendMessage(data.payload);
            break;
          case 'message.updated':
            setMessages((prev) => prev.map((m) => (m.id === data.payload.id ? data.payload : m)));
            break;
          case 'typing':
            setTypingUsers((t) => {
              const next = Array.from(new Set([...t.filter((u) => u !== data.user.id), data.user]));
              // remove after timeout handled elsewhere
              return next;
            });
            break;
          case 'presence':
            // presence updates (agent online/offline)
            // payload: { userId, status }
            // optionally show agent status in UI
            break;
          default:
            break;
        }
      } catch (err) {
        logger?.warn?.('Invalid WS message', { error: err?.message });
      } finally {
        // keep last seen for reconnection heuristics
        lastSeenRef.current = Date.now();
        // scroll to bottom for new messages
        setTimeout(() => scrollToBottom('auto'), 50);
      }
    },
    [appendMessage, scrollToBottom]
  );

  // Build and open WebSocket with backoff
  const connectWs = useCallback(() => {
    try {
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        return;
      }

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.addEventListener('open', () => {
        reconnectAttemptsRef.current = 0;
        setConnected(true);
        setError(null);
        logger?.info?.('Support WS connected', { conversationId });
        // identify/auth if needed
        if (token) {
          ws.send(JSON.stringify({ type: 'auth', payload: { token } }));
        }
        // subscribe to conversation
        ws.send(JSON.stringify({ type: 'subscribe', payload: { conversationId } }));
        // flush queued messages
        flushOfflineQueue();
      });

      ws.addEventListener('message', handleWsMessage);

      ws.addEventListener('close', (ev) => {
        setConnected(false);
        logger?.warn?.('Support WS closed', { code: ev.code, reason: ev.reason });
        // schedule reconnect
        const attempts = ++reconnectAttemptsRef.current;
        const delay = Math.min(WS_RECONNECT_BASE_MS * Math.pow(1.5, attempts - 1), WS_RECONNECT_MAX_MS);
        setTimeout(() => {
          if (!mountedRef.current) return;
          connectWs();
        }, delay + Math.floor(Math.random() * 300));
      });

      ws.addEventListener('error', (err) => {
        logger?.warn?.('Support WS error', { error: err?.message || 'unknown' });
        // close socket to trigger reconnect logic
        try {
          ws.close();
        } catch (_) {}
      });
    } catch (err) {
      logger?.error?.('Failed to create WS', { error: err?.message });
    }
  }, [conversationId, flushOfflineQueue, handleWsMessage, token, wsUrl]);

  // Initialize: load recent messages and connect WS
  useEffect(() => {
    mountedRef.current = true;

    (async () => {
      try {
        const resp = await api.get(`/api/support/${conversationId}/messages?limit=100`);
        const initial = resp?.data ?? [];
        setMessages(initial);
        setTimeout(() => scrollToBottom('auto'), 100);
      } catch (err) {
        logger?.warn?.('Failed to load initial messages', { error: err?.message });
        setError('Failed to load messages');
      }
    })();

    connectWs();

    return () => {
      mountedRef.current = false;
      try {
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
      } catch (_) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Typing indicator: send typing events debounced
  const sendTyping = useDebounce(
    useCallback(() => {
      try {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'typing', payload: { conversationId } }));
        }
      } catch (err) {
        // ignore
      }
    }, [conversationId]),
    400
  );

  // Input change handler
  const onInputChange = useCallback(
    (e) => {
      setInput(e.target.value);
      sendTyping();
    },
    [sendTyping]
  );

  // File attachment handler (upload to server, then attach)
  const handleFileChange = useCallback(
    async (e) => {
      const file = e?.target?.files?.[0];
      if (!file) return;
      setUploading(true);
      setError(null);

      try {
        const form = new FormData();
        form.append('file', file);
        const resp = await api.post(`/api/support/${conversationId}/attachments`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 60000,
        });
        const attachment = resp?.data;
        if (attachment) {
          setAttachments((prev) => [...prev, attachment]);
          toast?.success?.('Attachment uploaded');
        }
      } catch (err) {
        logger?.warn?.('Attachment upload failed', { error: err?.message });
        setError('Attachment upload failed');
      } finally {
        setUploading(false);
        // reset file input value if present
        try {
          e.target.value = '';
        } catch (_) {}
      }
    },
    [conversationId]
  );

  // Remove attachment
  const removeAttachment = useCallback((id) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Submit handler
  const handleSubmit = useCallback(
    async (e) => {
      e?.preventDefault?.();
      if (!input.trim() && attachments.length === 0) return;
      setSending(true);
      setError(null);
      try {
        await sendMessage({ text: input.trim(), attachments });
        setInput('');
        setAttachments([]);
        setTimeout(() => scrollToBottom('smooth'), 100);
      } catch (err) {
        setError('Failed to send message');
      } finally {
        if (mountedRef.current) setSending(false);
      }
    },
    [attachments, input, sendMessage, scrollToBottom]
  );

  // Keyboard shortcut: Ctrl+Enter to send
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (!sending) handleSubmit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSubmit, sending]);

  // Mark messages read when visible (simple heuristic)
  useEffect(() => {
    const markRead = async () => {
      try {
        await api.post(`/api/support/${conversationId}/read`);
      } catch (_) {}
    };
    const t = setTimeout(markRead, 1000);
    return () => clearTimeout(t);
  }, [messages, conversationId]);

  // Render
  return (
    <section className="support-chat card" aria-labelledby="support-chat-heading">
      <header className="support-chat-header flex items-center justify-between p-3 border-b">
        <div>
          <h2 id="support-chat-heading" className="text-lg font-semibold">
            {title}
          </h2>
          <div className="text-xs text-muted">
            {connected ? 'Connected' : 'Disconnected'} • {typingUsers.length ? `${typingUsers.join(', ')} typing…` : 'Support available'}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!connected && <Spinner size="sm" label="Reconnecting…" />}
          <button
            type="button"
            onClick={() => {
              // manual reconnect
              try {
                if (wsRef.current) wsRef.current.close();
              } catch (_) {}
              connectWs();
            }}
            className="btn-ghost"
            aria-label="Reconnect"
          >
            Reconnect
          </button>
        </div>
      </header>

      <div
        ref={listRef}
        className="support-chat-list p-3 overflow-auto"
        style={{ height: '420px', background: '#fff', borderBottom: '1px solid #eee' }}
        role="log"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted">
            <p>No messages yet. Start the conversation below.</p>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="mb-3">
              <MessageBubble message={m} currentUserId={user?.id} />
            </div>
          ))
        )}
      </div>

      <div className="support-chat-controls p-3">
        {error && (
          <div role="alert" className="mb-2 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
          <div className="flex-1">
            <label htmlFor="support-input" className="sr-only">
              Message
            </label>
            <textarea
              id="support-input"
              ref={inputRef}
              value={input}
              onChange={onInputChange}
              placeholder="Type your message… (Ctrl+Enter to send)"
              rows={2}
              className="input-field w-full resize-none"
              aria-label="Message"
              disabled={sending || uploading}
            />
            <div className="mt-2 flex items-center gap-2">
              <input
                id="file-upload"
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                disabled={uploading}
                aria-label="Attach file"
              />
              {uploading && <Spinner size="sm" label="Uploading…" />}
              <div className="text-xs text-muted ml-auto">{attachments.length} attachment(s)</div>
            </div>

            {attachments.length > 0 && (
              <div className="mt-2 flex gap-2 items-center">
                {attachments.map((a) => (
                  <AttachmentPreview key={a.id} attachment={a} onRemove={() => removeAttachment(a.id)} />
                ))}
              </div>
            )}
          </div>

          <div className="w-28">
            <button
              type="submit"
              className="btn-primary w-full"
              disabled={sending || uploading || (!input.trim() && attachments.length === 0)}
              aria-disabled={sending || uploading || (!input.trim() && attachments.length === 0)}
            >
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

SupportChat.propTypes = {
  conversationId: PropTypes.string,
  title: PropTypes.string,
};
