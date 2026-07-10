// frontend/src/components/chat/Composer.jsx

'use strict';

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import PropTypes from 'prop-types';
import { useDispatch } from 'react-redux';

import {
  sendMessage,
} from '../../store/chatSlice';

import './composer.css';

const DEFAULT_ALLOWED = [
  'application/pdf',
  'image/png',
  'image/jpg',
  'image/jpeg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
];

const MAX_FILE_SIZE =
  10 * 1024 * 1024;

function Composer({
  conversationId,
  onTypingStart,
  onTypingStop,
  allowAttachments = true,
  placeholder = 'Type a message...',
  disabled = false,
}) {
  const dispatch =
    useDispatch();

  const [text, setText] =
    useState('');

  const [sending, setSending] =
    useState(false);

  const [files, setFiles] =
    useState([]);

  const [error, setError] =
    useState(null);

  const textareaRef =
    useRef(null);

  const fileRef =
    useRef(null);

  const typingTimeout =
    useRef(null);

  const isTyping =
    useRef(false);

  /*
  |--------------------------------------------------------------------------
  | Cleanup
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    return () => {
      clearTimeout(
        typingTimeout.current
      );
    };
  }, []);

  /*
  |--------------------------------------------------------------------------
  | Auto Resize
  |--------------------------------------------------------------------------
  */

  const resizeTextarea =
    useCallback(() => {
      const el =
        textareaRef.current;

      if (!el) return;

      el.style.height = 'auto';
      el.style.height =
        `${el.scrollHeight}px`;
    }, []);

  /*
  |--------------------------------------------------------------------------
  | Typing Indicators
  |--------------------------------------------------------------------------
  */

  const handleTyping =
    useCallback(() => {
      if (!isTyping.current) {
        isTyping.current = true;
        onTypingStart?.();
      }

      clearTimeout(
        typingTimeout.current
      );

      typingTimeout.current =
        setTimeout(() => {
          isTyping.current = false;
          onTypingStop?.();
        }, 2500);
    }, [
      onTypingStart,
      onTypingStop,
    ]);

  /*
  |--------------------------------------------------------------------------
  | Text Change
  |--------------------------------------------------------------------------
  */

  const handleChange =
    useCallback(
      (e) => {
        setText(e.target.value);
        resizeTextarea();
        handleTyping();
      },
      [
        resizeTextarea,
        handleTyping,
      ]
    );

  /*
  |--------------------------------------------------------------------------
  | File Validation
  |--------------------------------------------------------------------------
  */

  const handleFileChange =
    useCallback((e) => {
      setError(null);

      const selected =
        Array.from(
          e.target.files || []
        );

      for (const file of selected) {
        if (
          !DEFAULT_ALLOWED.includes(
            file.type
          )
        ) {
          setError(
            `File type not allowed: ${file.type}`
          );
          return;
        }

        if (
          file.size >
          MAX_FILE_SIZE
        ) {
          setError(
            `${file.name} exceeds maximum size`
          );
          return;
        }
      }

      setFiles(selected);
    }, []);

  /*
  |--------------------------------------------------------------------------
  | Clear Files
  |--------------------------------------------------------------------------
  */

  const clearFiles =
    useCallback(() => {
      setFiles([]);

      if (fileRef.current) {
        fileRef.current.value =
          '';
      }
    }, []);

  /*
  |--------------------------------------------------------------------------
  | Send Message
  |--------------------------------------------------------------------------
  */

  const handleSend =
    useCallback(async () => {
      const trimmed =
        text.trim();

      if (
        !trimmed &&
        files.length === 0
      ) {
        return;
      }

      try {
        setSending(true);
        setError(null);

        await dispatch(
          sendMessage({
            conversationId,
            body: trimmed,
            attachments:
              files,
          })
        ).unwrap();

        setText('');
        clearFiles();

        if (
          textareaRef.current
        ) {
          textareaRef.current.style.height =
            'auto';

          textareaRef.current.focus();
        }

        isTyping.current = false;
        onTypingStop?.();
      } catch (err) {
        setError(
          err?.message ||
            'Unable to send message.'
        );
      } finally {
        setSending(false);
      }
    }, [
      dispatch,
      conversationId,
      text,
      files,
      clearFiles,
      onTypingStop,
    ]);

  /*
  |--------------------------------------------------------------------------
  | Keyboard Submit
  |--------------------------------------------------------------------------
  */

  const handleKeyDown =
    useCallback(
      (e) => {
        if (
          e.key === 'Enter' &&
          !e.shiftKey
        ) {
          e.preventDefault();
          handleSend();
        }
      },
      [handleSend]
    );

  return (
    <div className="composer">
      <div className="composer-inner">
        <textarea
          ref={textareaRef}
          value={text}
          disabled={
            disabled || sending
          }
          placeholder={
            placeholder
          }
          className="composer-input"
          rows={1}
          onChange={
            handleChange
          }
          onKeyDown={
            handleKeyDown
          }
          aria-label="Message input"
        />

        {allowAttachments && (
          <div className="composer-files">
            <label
              htmlFor="chat-file"
              className="composer-file-button"
            >
              📎
            </label>

            <input
              id="chat-file"
              ref={fileRef}
              type="file"
              multiple
              hidden
              onChange={
                handleFileChange
              }
            />
          </div>
        )}

        <button
          type="button"
          className="composer-send"
          disabled={
            sending ||
            disabled ||
            (
              !text.trim() &&
              files.length === 0
            )
          }
          onClick={
            handleSend
          }
        >
          {sending
            ? 'Sending...'
            : 'Send'}
        </button>
      </div>

      {files.length > 0 && (
        <div className="attachment-preview">
          {files.map((f) => (
            <div
              key={f.name}
              className="attachment-item"
            >
              {f.name}
            </div>
          ))}

          <button
            type="button"
            onClick={clearFiles}
            className="attachment-clear"
          >
            Clear
          </button>
        </div>
      )}

      {error && (
        <div
          className="composer-error"
          role="alert"
        >
          {error}
        </div>
      )}
    </div>
  );
}

Composer.propTypes = {
  conversationId:
    PropTypes.string.isRequired,
  onTypingStart:
    PropTypes.func,
  onTypingStop:
    PropTypes.func,
  allowAttachments:
    PropTypes.bool,
  placeholder:
    PropTypes.string,
  disabled:
    PropTypes.bool,
};

export default React.memo(
  Composer
);