'use strict';

/**
 * ============================================================================
 * COMPOSER COMPONENT
 * ============================================================================
 * TITech Community Capital LTD (ACFOS)
 * TITechChat Enterprise Messaging Platform
 *
 * PURPOSE
 * ----------------------------------------------------------------------------
 * Production-grade message composer used throughout TITechChat.
 *
 * FEATURES
 * ----------------------------------------------------------------------------
 * ✅ Controlled message input
 * ✅ Auto-growing textarea
 * ✅ Attachment uploads
 * ✅ File validation
 * ✅ Drag & Drop support
 * ✅ Typing indicators
 * ✅ Keyboard shortcuts
 * ✅ Async send support
 * ✅ Loading states
 * ✅ Error handling
 * ✅ Accessibility (ARIA)
 * ✅ Mobile friendly
 * ✅ Enterprise extensibility
 *
 * FUTURE FEATURES
 * ----------------------------------------------------------------------------
 * - Voice notes
 * - Emoji picker
 * - Message templates
 * - AI suggestions
 * - Rich text formatting
 * - Mentions (@user)
 * - GIF support
 *
 * ============================================================================
 */

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from 'react';
import PropTypes from 'prop-types';

const DEFAULT_ALLOWED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpg',
  'image/jpeg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;

export default function Composer({
  onSend,
  onTypingStart,
  onTypingStop,
  placeholder = 'Write a message...',
  allowAttachments = true,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  allowedMimeTypes = DEFAULT_ALLOWED_TYPES,
  disabled = false,
  autoFocus = false,
  maxMessageLength = 2000,
  ariaLabel = 'Message Composer',
}) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const typingActiveRef = useRef(false);

  /*
  |--------------------------------------------------------------------------
  | Auto Focus
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (autoFocus) {
      textareaRef.current?.focus();
    }
  }, [autoFocus]);

  /*
  |--------------------------------------------------------------------------
  | Cleanup
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    return () => {
      clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  /*
  |--------------------------------------------------------------------------
  | Auto Resize
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  /*
  |--------------------------------------------------------------------------
  | Typing Indicator
  |--------------------------------------------------------------------------
  */

  const emitTyping = useCallback(() => {
    if (!typingActiveRef.current) {
      typingActiveRef.current = true;
      onTypingStart?.();
    }

    clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      typingActiveRef.current = false;
      onTypingStop?.();
    }, 2500);
  }, [onTypingStart, onTypingStop]);

  /*
  |--------------------------------------------------------------------------
  | Text Change
  |--------------------------------------------------------------------------
  */

  const handleTextChange = useCallback(
    (e) => {
      const value = e.target.value;

      if (value.length > maxMessageLength) {
        return;
      }

      setText(value);
      emitTyping();
    },
    [emitTyping, maxMessageLength]
  );

  /*
  |--------------------------------------------------------------------------
  | File Validation
  |--------------------------------------------------------------------------
  */

  const validateFiles = useCallback(
    (files) => {
      const list = Array.from(files || []);

      for (const file of list) {
        if (!allowedMimeTypes.includes(file.type)) {
          return {
            valid: false,
            error: `Unsupported file type: ${file.type}`,
          };
        }

        if (file.size > maxFileSize) {
          return {
            valid: false,
            error: `${file.name} exceeds the maximum file size.`,
          };
        }
      }

      return {
        valid: true,
        files: list,
      };
    },
    [allowedMimeTypes, maxFileSize]
  );

  /*
  |--------------------------------------------------------------------------
  | Attachment Upload
  |--------------------------------------------------------------------------
  */

  const handleFileChange = useCallback(
    (e) => {
      setError('');

      const result = validateFiles(e.target.files);

      if (!result.valid) {
        setError(result.error);
        e.target.value = '';
        return;
      }

      setAttachments((prev) => [
        ...prev,
        ...result.files,
      ]);
    },
    [validateFiles]
  );

  /*
  |--------------------------------------------------------------------------
  | Drag & Drop
  |--------------------------------------------------------------------------
  */

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();

      if (!allowAttachments) return;

      const result = validateFiles(
        e.dataTransfer.files
      );

      if (!result.valid) {
        setError(result.error);
        return;
      }

      setAttachments((prev) => [
        ...prev,
        ...result.files,
      ]);
    },
    [allowAttachments, validateFiles]
  );

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
  }, []);

  /*
  |--------------------------------------------------------------------------
  | Remove Attachment
  |--------------------------------------------------------------------------
  */

  const removeAttachment = useCallback((index) => {
    setAttachments((prev) =>
      prev.filter((_, i) => i !== index)
    );
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  /*
  |--------------------------------------------------------------------------
  | Derived State
  |--------------------------------------------------------------------------
  */

  const canSend = useMemo(() => {
    return (
      !disabled &&
      !sending &&
      (text.trim().length > 0 ||
        attachments.length > 0)
    );
  }, [
    disabled,
    sending,
    text,
    attachments,
  ]);

  /*
  |--------------------------------------------------------------------------
  | Submit
  |--------------------------------------------------------------------------
  */

  const submit = useCallback(
    async (e) => {
      e?.preventDefault();

      if (!canSend) return;

      setSending(true);
      setError('');

      try {
        await onSend?.(
          text.trim(),
          attachments
        );

        setText('');
        clearAttachments();

        typingActiveRef.current = false;
        onTypingStop?.();

        textareaRef.current?.focus();
      } catch (err) {
        setError(
          err?.message ||
            'Unable to send message.'
        );
      } finally {
        setSending(false);
      }
    },
    [
      attachments,
      canSend,
      clearAttachments,
      onSend,
      onTypingStop,
      text,
    ]
  );

  /*
  |--------------------------------------------------------------------------
  | Keyboard Shortcut
  |--------------------------------------------------------------------------
  */

  const handleKeyDown = useCallback(
    (e) => {
      if (
        e.key === 'Enter' &&
        !e.shiftKey
      ) {
        submit(e);
      }
    },
    [submit]
  );

  /*
  |--------------------------------------------------------------------------
  | Render
  |--------------------------------------------------------------------------
  */

  return (
    <form
      className="chat-composer"
      onSubmit={submit}
      aria-label={ariaLabel}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <div className="chat-composer-container">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || sending}
          className="chat-composer-input"
          rows={1}
          maxLength={maxMessageLength}
          aria-label="Message input"
        />

        {allowAttachments && (
          <div className="chat-composer-attachments">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={handleFileChange}
            />

            <button
              type="button"
              className="chat-composer-attach-btn"
              disabled={disabled || sending}
              onClick={() =>
                fileInputRef.current?.click()
              }
            >
              📎
            </button>
          </div>
        )}

        <button
          type="submit"
          className="chat-composer-send-btn"
          disabled={!canSend}
        >
          {sending
            ? 'Sending...'
            : 'Send'}
        </button>
      </div>

      {attachments.length > 0 && (
        <div className="chat-composer-preview">
          {attachments.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="chat-composer-file"
            >
              <span>{file.name}</span>

              <button
                type="button"
                onClick={() =>
                  removeAttachment(index)
                }
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div
          className="chat-composer-error"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="chat-composer-footer">
        <small>
          {text.length}/
          {maxMessageLength}
        </small>
      </div>
    </form>
  );
}

Composer.propTypes = {
  onSend: PropTypes.func.isRequired,
  onTypingStart: PropTypes.func,
  onTypingStop: PropTypes.func,
  placeholder: PropTypes.string,
  allowAttachments: PropTypes.bool,
  maxFileSize: PropTypes.number,
  allowedMimeTypes: PropTypes.arrayOf(
    PropTypes.string
  ),
  disabled: PropTypes.bool,
  autoFocus: PropTypes.bool,
  maxMessageLength: PropTypes.number,
  ariaLabel: PropTypes.string,
};