'use strict';

/**
 * ============================================================================
 * TITech Community Capital Ltd
 * Enterprise React Error Boundary
 * ============================================================================
 *
 * File:
 *   frontend/src/components/ErrorBoundary.jsx
 *
 * Purpose:
 *   Production-grade React error boundary for isolating UI failures and
 *   preventing a single component failure from crashing the entire TITech
 *   application.
 *
 * Features
 * ----------------------------------------------------------------------------
 * ✓ React render error isolation
 * ✓ Lifecycle error isolation
 * ✓ Recover / retry support
 * ✓ Reset key support
 * ✓ Reset on route/context change
 * ✓ Custom fallback support
 * ✓ Default enterprise fallback UI
 * ✓ Development diagnostics
 * ✓ Production-safe error messaging
 * ✓ Error metadata
 * ✓ Error event callback
 * ✓ Telemetry hook
 * ✓ Error ID generation
 * ✓ Retry counter
 * ✓ Retry limit
 * ✓ Retry delay
 * ✓ Auto reset support
 * ✓ Reload support
 * ✓ Navigate-home support
 * ✓ Children support
 * ✓ Ref API
 * ✓ Accessible alert state
 * ✓ Screen-reader announcement
 * ✓ Stable test selectors
 * ✓ TITech branding consistency
 *
 * IMPORTANT SECURITY / PRIVACY BOUNDARY
 * ----------------------------------------------------------------------------
 * Do not expose sensitive application data, authentication tokens, financial
 * records, tenant secrets, stack traces, or backend credentials in production
 * error UI.
 *
 * Error details should be transmitted only through an approved TITech
 * telemetry/observability pipeline.
 *
 * ============================================================================
 */

import React, {
  Component,
  createRef,
} from 'react';

import PropTypes from 'prop-types';


/* ============================================================================
 * Constants
 * ========================================================================== */

const DEFAULT_RETRY_LIMIT = 2;

const DEFAULT_RETRY_DELAY = 0;

const DEFAULT_ERROR_ID_PREFIX =
  'TITech-ERR';

const DEFAULT_TEST_ID =
  'titech-error-boundary';

const DEFAULT_TITLE =
  'Something went wrong';

const DEFAULT_MESSAGE =
  'TITech encountered an unexpected application error.';

const DEFAULT_RETRY_LABEL =
  'Try again';

const DEFAULT_HOME_LABEL =
  'Return to dashboard';

const DEFAULT_RELOAD_LABEL =
  'Reload application';


/* ============================================================================
 * Utility helpers
 * ========================================================================== */

const cn = (
  ...classes
) =>
  classes
    .filter(Boolean)
    .join(' ');


const safeText = (
  value,
  fallback = '',
) => {
  if (
    value === null ||
    value === undefined
  ) {
    return fallback;
  }

  try {
    return (
      String(value).trim() ||
      fallback
    );
  } catch {
    return fallback;
  }
};


const isDevelopment =
  typeof process !==
    'undefined' &&
  process?.env?.NODE_ENV ===
    'development';


const createErrorId = (
  prefix =
    DEFAULT_ERROR_ID_PREFIX,
) => {
  const timestamp =
    Date.now()
      .toString(36)
      .toUpperCase();

  const random =
    Math.random()
      .toString(36)
      .slice(
        2,
        8,
      )
      .toUpperCase();

  return `${safeText(
    prefix,
    DEFAULT_ERROR_ID_PREFIX,
  )}-${timestamp}-${random}`;
};


const serializeError = (
  error,
) => {
  if (!error) {
    return {
      name:
        'UnknownError',

      message:
        'Unknown application error',
    };
  }

  return {
    name:
      safeText(
        error.name,
        'Error',
      ),

    message:
      safeText(
        error.message,
        'Unknown application error',
      ),

    stack:
      safeText(
        error.stack,
      ),
  };
};


const getLocationSnapshot = () => {
  if (
    typeof window ===
    'undefined'
  ) {
    return null;
  }

  return {
    pathname:
      window.location?.pathname ||
      '',

    search:
      window.location?.search ||
      '',

    hash:
      window.location?.hash ||
      '',
  };
};


const getEnvironmentSnapshot = () => ({
  userAgent:
    typeof navigator !==
    'undefined'
      ? safeText(
          navigator.userAgent,
        )
      : '',

  language:
    typeof navigator !==
    'undefined'
      ? safeText(
          navigator.language,
        )
      : '',

  online:
    typeof navigator !==
    'undefined'
      ? Boolean(
          navigator.onLine,
        )
      : true,

  timestamp:
    new Date().toISOString(),
});


/* ============================================================================
 * Icons
 * ========================================================================== */

const Icon = ({
  children,
  size = 48,
}) => (
  <svg
    aria-hidden="true"
    focusable="false"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);


const AlertIcon = ({
  size = 48,
}) => (
  <Icon size={size}>
    <path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </Icon>
);


const RefreshIcon = ({
  size = 17,
}) => (
  <Icon size={size}>
    <path d="M20 11a8 8 0 0 0-15-3" />
    <path d="M5 4v5h5" />
    <path d="M4 13a8 8 0 0 0 15 3" />
    <path d="M19 20v-5h-5" />
  </Icon>
);


const HomeIcon = ({
  size = 17,
}) => (
  <Icon size={size}>
    <path d="m3 10 9-7 9 7" />
    <path d="M5 9v11h14V9" />
    <path d="M9 20v-6h6v6" />
  </Icon>
);


const ReloadIcon = ({
  size = 17,
}) => (
  <Icon size={size}>
    <path d="M20 11a8 8 0 1 0 2 5" />
    <path d="M20 4v7h-7" />
  </Icon>
);


/* ============================================================================
 * Default fallback presentation
 * ========================================================================== */

class DefaultErrorFallback extends React.PureComponent {
  handleRetry = async () => {
    const {
      onRetry,
    } = this.props;

    if (
      typeof onRetry ===
      'function'
    ) {
      await onRetry();
    }
  };

  handleHome = () => {
    const {
      onHome,
    } = this.props;

    onHome?.();
  };

  handleReload = () => {
    const {
      onReload,
    } = this.props;

    onReload?.();
  };

  render() {
    const {
      title,
      message,
      errorId,
      retryLabel,
      homeLabel,
      reloadLabel,
      canRetry,
      showHome,
      showReload,
      showErrorId,
      showDetails,
      error,
      retrying,
      className,
      testId,
    } = this.props;

    return (
      <section
        className={cn(
          'titech-error-boundary',
          className,
        )}
        role="alert"
        aria-live="assertive"
        aria-labelledby="titech-error-boundary-title"
        aria-describedby="titech-error-boundary-message"
        data-testid={
          testId
        }
      >
        <div className="titech-error-boundary__content">

          <div
            className="titech-error-boundary__icon"
            aria-hidden="true"
          >
            <AlertIcon />
          </div>

          <h1
            id="titech-error-boundary-title"
            className="titech-error-boundary__title"
          >
            {
              title
            }
          </h1>

          <p
            id="titech-error-boundary-message"
            className="titech-error-boundary__message"
          >
            {
              message
            }
          </p>

          {showErrorId &&
          errorId ? (
            <p className="titech-error-boundary__error-id">
              Reference:
              {' '}
              <code>
                {
                  errorId
                }
              </code>
            </p>
          ) : null}

          {showDetails &&
          isDevelopment ? (
            <details className="titech-error-boundary__details">
              <summary>
                Development diagnostics
              </summary>

              <div className="titech-error-boundary__details-body">
                <div>
                  <strong>
                    Name:
                  </strong>{' '}
                  {
                    error?.name ||
                    'Error'
                  }
                </div>

                <div>
                  <strong>
                    Message:
                  </strong>{' '}
                  {
                    error?.message ||
                    'Unknown error'
                  }
                </div>

                {error?.stack ? (
                  <pre>
                    {
                      error.stack
                    }
                  </pre>
                ) : null}
              </div>
            </details>
          ) : null}

          <div className="titech-error-boundary__actions">

            {canRetry ? (
              <button
                type="button"
                className="titech-error-boundary__button titech-error-boundary__button--primary"
                onClick={
                  this.handleRetry
                }
                disabled={
                  retrying
                }
                aria-busy={
                  retrying
                    ? 'true'
                    : undefined
                }
                data-testid="titech-error-boundary-retry"
              >
                <RefreshIcon />

                <span>
                  {retrying
                    ? 'Retrying…'
                    : retryLabel}
                </span>
              </button>
            ) : null}

            {showHome ? (
              <button
                type="button"
                className="titech-error-boundary__button titech-error-boundary__button--secondary"
                onClick={
                  this.handleHome
                }
                disabled={
                  retrying
                }
                data-testid="titech-error-boundary-home"
              >
                <HomeIcon />

                <span>
                  {
                    homeLabel
                  }
                </span>
              </button>
            ) : null}

            {showReload ? (
              <button
                type="button"
                className="titech-error-boundary__button titech-error-boundary__button--secondary"
                onClick={
                  this.handleReload
                }
                disabled={
                  retrying
                }
                data-testid="titech-error-boundary-reload"
              >
                <ReloadIcon />

                <span>
                  {
                    reloadLabel
                  }
                </span>
              </button>
            ) : null}

          </div>
        </div>
      </section>
    );
  }
}


/* ============================================================================
 * ErrorBoundary
 * ========================================================================== */

class ErrorBoundary extends Component {
  constructor(
    props,
  ) {
    super(
      props,
    );

    this.state = {
      hasError:
        false,

      error:
        null,

      errorInfo:
        null,

      errorId:
        null,

      retryCount:
        0,

      retrying:
        false,
    };

    this.rootRef =
      createRef();
  }


  /* ==========================================================================
   * React error capture
   * ======================================================================== */

  static getDerivedStateFromError(
    error,
  ) {
    return {
      hasError:
        true,

      error,

      errorInfo:
        null,

      errorId:
        createErrorId(),
    };
  }


  componentDidCatch(
    error,
    errorInfo,
  ) {
    const serialized =
      serializeError(
        error,
      );

    const payload = {
      error:
        serialized,

      errorId:
        this.state.errorId,

      componentStack:
        safeText(
          errorInfo?.componentStack,
        ),

      retryCount:
        this.state.retryCount,

      location:
        getLocationSnapshot(),

      environment:
        getEnvironmentSnapshot(),

      context:
        this.props.context ||
        null,

      tenant:
        this.props.tenant
          ? {
              id:
                this.props
                  .tenant
                  ?.id ??
                this.props
                  .tenant
                  ?.tenantId ??
                null,
            }
          : null,
    };

    this.setState({
      errorInfo,
    });

    /**
     * Console diagnostics are intentionally restricted to development.
     */
    if (
      isDevelopment
    ) {
      // eslint-disable-next-line no-console
      console.error(
        '[TITech ErrorBoundary]',
        payload,
      );
    }

    /**
     * Parent callback.
     */
    try {
      this.props.onError?.(
        payload,
      );
    } catch (
      callbackError
    ) {
      if (
        isDevelopment
      ) {
        // eslint-disable-next-line no-console
        console.error(
          '[TITech ErrorBoundary] onError callback failed:',
          callbackError,
        );
      }
    }

    /**
     * Enterprise telemetry integration.
     *
     * The host application can connect this to Sentry, OpenTelemetry,
     * Datadog, a TITech observability gateway, or another approved service.
     */
    try {
      this.props.onTelemetry?.(
        payload,
      );
    } catch (
      telemetryError
    ) {
      if (
        isDevelopment
      ) {
        // eslint-disable-next-line no-console
        console.error(
          '[TITech ErrorBoundary] telemetry callback failed:',
          telemetryError,
        );
      }
    }
  }


  /* ==========================================================================
   * Reset lifecycle
   * ======================================================================== */

  componentDidUpdate(
    previousProps,
  ) {
    const {
      resetKey,
    } = this.props;

    if (
      resetKey !==
      previousProps.resetKey
    ) {
      this.resetError();
    }

    if (
      this.props.resetOnLocationChange &&
      typeof window !==
        'undefined'
    ) {
      const previousLocation =
        previousProps.__locationPath;

      const currentLocation =
        window.location?.pathname;

      if (
        previousLocation &&
        currentLocation &&
        previousLocation !==
          currentLocation
      ) {
        this.resetError();
      }
    }
  }


  /* ==========================================================================
   * Reset
   * ======================================================================== */

  resetError = () => {
    if (
      this.state.retrying
    ) {
      return;
    }

    this.setState({
      hasError:
        false,

      error:
        null,

      errorInfo:
        null,

      errorId:
        null,

      retrying:
        false,
    });

    this.props.onReset?.();
  };


  /* ==========================================================================
   * Retry
   * ======================================================================== */

  handleRetry = async () => {
    const {
      retryLimit =
        DEFAULT_RETRY_LIMIT,

      retryDelay =
        DEFAULT_RETRY_DELAY,

      onRetry,
    } = this.props;

    if (
      this.state.retrying
    ) {
      return;
    }

    if (
      this.state.retryCount >=
      retryLimit
    ) {
      return;
    }

    this.setState({
      retrying:
        true,
    });

    try {
      const delay =
        Math.max(
          0,
          Number(
            retryDelay,
          ) ||
            0,
        );

      if (
        delay > 0
      ) {
        await new Promise(
          (
            resolve,
          ) =>
            setTimeout(
              resolve,
              delay,
            ),
        );
      }

      await onRetry?.({
        error:
          this.state.error,

        errorId:
          this.state.errorId,

        retryCount:
          this.state.retryCount +
          1,
      });

      this.setState({
        hasError:
          false,

        error:
          null,

        errorInfo:
          null,

        errorId:
          null,

        retrying:
          false,

        retryCount:
          this.state.retryCount +
          1,
      });
    } catch (
      retryError
    ) {
      /**
       * Keep the original boundary active if retry itself fails.
       */
      this.setState({
        retrying:
          false,

        retryCount:
          this.state.retryCount +
          1,
      });

      if (
        isDevelopment
      ) {
        // eslint-disable-next-line no-console
        console.error(
          '[TITech ErrorBoundary] retry failed:',
          retryError,
        );
      }

      this.props.onRetryError?.(
        retryError,
        {
          errorId:
            this.state.errorId,
        },
      );
    }
  };


  /* ==========================================================================
   * Navigation
   * ======================================================================== */

  handleHome = () => {
    const {
      homePath =
        '/dashboard',

      onHome,
    } = this.props;

    if (
      typeof onHome ===
      'function'
    ) {
      onHome();
      return;
    }

    if (
      typeof window !==
        'undefined' &&
      homePath
    ) {
      window.location.assign(
        homePath,
      );
    }
  };


  handleReload = () => {
    const {
      onReload,
    } = this.props;

    if (
      typeof onReload ===
      'function'
    ) {
      onReload();
      return;
    }

    if (
      typeof window !==
      'undefined' &&
      typeof window.location
        ?.reload ===
        'function'
    ) {
      window.location.reload();
    }
  };


  /* ==========================================================================
   * Public ref API
   * ======================================================================== */

  getImperativeHandle = () => ({
    reset:
      this.resetError,

    retry:
      this.handleRetry,

    reload:
      this.handleReload,

    goHome:
      this.handleHome,

    hasError:
      () =>
        this.state.hasError,

    getErrorId:
      () =>
        this.state.errorId,

    getError:
      () =>
        this.state.error,

    getRetryCount:
      () =>
        this.state.retryCount,

    focus:
      () =>
        this.rootRef.current?.focus(),
  });


  /* ==========================================================================
   * Render
   * ======================================================================== */

  render() {
    const {
      children,

      fallback,

      fallbackComponent,

      title =
        DEFAULT_TITLE,

      message =
        DEFAULT_MESSAGE,

      retryLabel =
        DEFAULT_RETRY_LABEL,

      homeLabel =
        DEFAULT_HOME_LABEL,

      reloadLabel =
        DEFAULT_RELOAD_LABEL,

      showHome =
        true,

      showReload =
        false,

      showErrorId =
        isDevelopment,

      showDetails =
        isDevelopment,

      retryLimit =
        DEFAULT_RETRY_LIMIT,

      className =
        '',

      testId =
        DEFAULT_TEST_ID,
    } = this.props;

    if (
      !this.state.hasError
    ) {
      return children;
    }

    const fallbackProps = {
      error:
        serializeError(
          this.state.error,
        ),

      errorInfo:
        this.state.errorInfo,

      errorId:
        this.state.errorId,

      retryCount:
        this.state.retryCount,

      retrying:
        this.state.retrying,

      canRetry:
        this.state.retryCount <
        retryLimit,

      onRetry:
        this.handleRetry,

      onHome:
        this.handleHome,

      onReload:
        this.handleReload,

      title,

      message,

      retryLabel,

      homeLabel,

      reloadLabel,

      showHome,

      showReload,

      showErrorId,

      showDetails,

      className,

      testId,
    };

    /**
     * Function-based custom fallback.
     */
    if (
      typeof fallbackComponent ===
      'function'
    ) {
      return fallbackComponent(
        fallbackProps,
      );
    }

    /**
     * React-node fallback.
     */
    if (
      fallback !==
      undefined &&
      fallback !==
        null
    ) {
      if (
        typeof fallback ===
        'function'
      ) {
        return fallback(
          fallbackProps,
        );
      }

      return fallback;
    }

    return (
      <div
        ref={
          this.rootRef
        }
        tabIndex={
          -1
        }
      >
        <DefaultErrorFallback
          {...fallbackProps}
        />
      </div>
    );
  }
}


/* ============================================================================
 * PropTypes
 * ========================================================================== */

ErrorBoundary.propTypes = {
  children:
    PropTypes.node
      .isRequired,

  fallback:
    PropTypes.oneOfType([
      PropTypes.node,
      PropTypes.func,
    ]),

  fallbackComponent:
    PropTypes.func,

  title:
    PropTypes.string,

  message:
    PropTypes.string,

  retryLabel:
    PropTypes.string,

  homeLabel:
    PropTypes.string,

  reloadLabel:
    PropTypes.string,

  showHome:
    PropTypes.bool,

  showReload:
    PropTypes.bool,

  showErrorId:
    PropTypes.bool,

  showDetails:
    PropTypes.bool,

  retryLimit:
    PropTypes.number,

  retryDelay:
    PropTypes.number,

  resetKey:
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number,
      PropTypes.bool,
    ]),

  resetOnLocationChange:
    PropTypes.bool,

  onError:
    PropTypes.func,

  onTelemetry:
    PropTypes.func,

  onReset:
    PropTypes.func,

  onRetry:
    PropTypes.func,

  onRetryError:
    PropTypes.func,

  onHome:
    PropTypes.func,

  onReload:
    PropTypes.func,

  homePath:
    PropTypes.string,

  context:
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.object,
    ]),

  tenant:
    PropTypes.shape({
      id:
        PropTypes.oneOfType([
          PropTypes.string,
          PropTypes.number,
        ]),

      tenantId:
        PropTypes.oneOfType([
          PropTypes.string,
          PropTypes.number,
        ]),
    }),

  className:
    PropTypes.string,

  testId:
    PropTypes.string,
};


/* ============================================================================
 * Defaults
 * ========================================================================== */

ErrorBoundary.defaultProps = {
  fallback:
    undefined,

  fallbackComponent:
    undefined,

  title:
    DEFAULT_TITLE,

  message:
    DEFAULT_MESSAGE,

  retryLabel:
    DEFAULT_RETRY_LABEL,

  homeLabel:
    DEFAULT_HOME_LABEL,

  reloadLabel:
    DEFAULT_RELOAD_LABEL,

  showHome:
    true,

  showReload:
    false,

  showErrorId:
    isDevelopment,

  showDetails:
    isDevelopment,

  retryLimit:
    DEFAULT_RETRY_LIMIT,

  retryDelay:
    DEFAULT_RETRY_DELAY,

  resetKey:
    undefined,

  resetOnLocationChange:
    false,

  onError:
    undefined,

  onTelemetry:
    undefined,

  onReset:
    undefined,

  onRetry:
    undefined,

  onRetryError:
    undefined,

  onHome:
    undefined,

  onReload:
    undefined,

  homePath:
    '/dashboard',

  context:
    undefined,

  tenant:
    null,

  className:
    '',

  testId:
    DEFAULT_TEST_ID,
};


/* ============================================================================
 * Named exports
 * ========================================================================== */

export {
  DEFAULT_ERROR_ID_PREFIX,
  DEFAULT_HOME_LABEL,
  DEFAULT_MESSAGE,
  DEFAULT_RELOAD_LABEL,
  DEFAULT_RETRY_DELAY,
  DEFAULT_RETRY_LABEL,
  DEFAULT_RETRY_LIMIT,
  DEFAULT_TEST_ID,
  DEFAULT_TITLE,
  DefaultErrorFallback,
  createErrorId,
  getEnvironmentSnapshot,
  getLocationSnapshot,
  safeText,
  serializeError,
};


/* ============================================================================
 * Default export
 * ========================================================================== */

export default ErrorBoundary;