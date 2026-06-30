// ============================================================================
// TITech Community Capital
// Enterprise Button Component
// File: src/components/ui/Button.jsx
// Production Grade
// ============================================================================

import React, {
  forwardRef,
  memo,
} from "react";

import PropTypes from "prop-types";
import { Loader2 } from "lucide-react";

// ============================================================================
// Variants
// ============================================================================

const VARIANTS = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  success: "btn-success",
  danger: "btn-danger",
  warning: "btn-warning",
  info: "btn-info",
  ghost: "btn-ghost",
  outline: "btn-outline",
  link: "btn-link",
};

const SIZES = {
  xs: "btn-xs",
  sm: "btn-sm",
  md: "btn-md",
  lg: "btn-lg",
  xl: "btn-xl",
};

// ============================================================================
// Component
// ============================================================================

const Button = forwardRef(
  (
    {
      children,
      type = "button",
      variant = "primary",
      size = "md",
      loading = false,
      disabled = false,
      fullWidth = false,
      rounded = false,
      leftIcon,
      rightIcon,
      className = "",
      loadingText = "Please wait...",
      as: Component = "button",
      ...props
    },
    ref
  ) => {
    const isDisabled =
      disabled || loading;

    const classes = [
      "tt-btn",
      VARIANTS[
        variant
      ] ||
        VARIANTS.primary,
      SIZES[size] ||
        SIZES.md,
      fullWidth
        ? "btn-block"
        : "",
      rounded
        ? "btn-rounded"
        : "",
      loading
        ? "btn-loading"
        : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <Component
        ref={ref}
        type={
          Component ===
          "button"
            ? type
            : undefined
        }
        className={
          classes
        }
        disabled={
          isDisabled
        }
        aria-disabled={
          isDisabled
        }
        aria-busy={
          loading
        }
        {...props}
      >
        {loading ? (
          <>
            <Loader2
              size={18}
              className="btn-spinner"
            />

            <span>
              {
                loadingText
              }
            </span>
          </>
        ) : (
          <>
            {leftIcon && (
              <span className="btn-icon btn-icon-left">
                {leftIcon}
              </span>
            )}

            <span className="btn-content">
              {children}
            </span>

            {rightIcon && (
              <span className="btn-icon btn-icon-right">
                {rightIcon}
              </span>
            )}
          </>
        )}
      </Component>
    );
  }
);

Button.displayName =
  "Button";

// ============================================================================
// Prop Types
// ============================================================================

Button.propTypes = {
  children:
    PropTypes.node,

  type:
    PropTypes.oneOf([
      "button",
      "submit",
      "reset",
    ]),

  variant:
    PropTypes.oneOf(
      Object.keys(
        VARIANTS
      )
    ),

  size:
    PropTypes.oneOf(
      Object.keys(
        SIZES
      )
    ),

  loading:
    PropTypes.bool,

  disabled:
    PropTypes.bool,

  fullWidth:
    PropTypes.bool,

  rounded:
    PropTypes.bool,

  leftIcon:
    PropTypes.node,

  rightIcon:
    PropTypes.node,

  className:
    PropTypes.string,

  loadingText:
    PropTypes.string,

  as:
    PropTypes.elementType,
};

// ============================================================================
// Export
// ============================================================================

export default memo(
  Button
);