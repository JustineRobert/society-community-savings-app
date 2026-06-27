// ============================================================================
// TITech Community Capital – Common Modal Component
// File: frontend/src/components/common/Modal.jsx
// ============================================================================

import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { createPortal } from 'react-dom';

// ---------------------------------------------------------------------------
// Modal Component
// ---------------------------------------------------------------------------
const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md', // sm | md | lg | xl
  closeOnOverlayClick = true,
  showCloseButton = true,
  ariaLabel,
}) => {
  const overlayRef = useRef(null);
  const modalRef = useRef(null);

  // Close on ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;
    const focusable = modalRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length) focusable[0].focus();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (closeOnOverlayClick && e.target === overlayRef.current) {
      onClose?.();
    }
  };

  const sizeMap = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
  };

  return createPortal(
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      aria-modal="true"
      role="dialog"
      aria-label={ariaLabel || title || 'Modal'}
    >
      <div
        ref={modalRef}
        className={`bg-white rounded-lg shadow-lg w-full ${sizeMap[size]} mx-4`}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex justify-between items-center border-b px-4 py-2">
            {title && <h2 className="text-lg font-semibold">{title}</h2>}
            {showCloseButton && (
              <button
                onClick={onClose}
                aria-label="Close modal"
                className="text-gray-600 hover:text-gray-900 focus:outline-none"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="p-4 overflow-y-auto max-h-[70vh]">{children}</div>
      </div>
    </div>,
    document.body
  );
};

// ---------------------------------------------------------------------------
// PropTypes
// ---------------------------------------------------------------------------
Modal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func,
  title: PropTypes.string,
  children: PropTypes.node.isRequired,
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl']),
  closeOnOverlayClick: PropTypes.bool,
  showCloseButton: PropTypes.bool,
  ariaLabel: PropTypes.string,
};

export default Modal;
