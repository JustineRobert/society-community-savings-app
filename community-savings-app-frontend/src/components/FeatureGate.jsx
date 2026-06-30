// ============================================================================
// TITech Community Capital
// Enterprise Feature Gate
// File: src/components/FeatureGate.jsx
// Production Grade
// Multi-Tenant | SaaS | Feature Flags | Licensing | A/B Testing
// ============================================================================

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";

import PropTypes from "prop-types";

// ============================================================================
// Constants
// ============================================================================

export const FEATURES = Object.freeze({
  DASHBOARD: "dashboard",
  MEMBERS: "members",
  SAVINGS: "savings",
  LOANS: "loans",
  TRANSACTIONS: "transactions",
  REPORTS: "reports",
  BILLING: "billing",
  KYC: "kyc",
  AML: "aml",
  USSD: "ussd",
  MOBILE_MONEY: "mobile_money",
  TREASURY: "treasury",
  EXECUTIVE_DASHBOARD:
    "executive_dashboard",
  FRAUD_DETECTION:
    "fraud_detection",
  REGULATORY_REPORTING:
    "regulatory_reporting",
  TENANT_MANAGEMENT:
    "tenant_management",
  API_ACCESS: "api_access",
});

// ============================================================================
// Context
// ============================================================================

const FeatureContext =
  createContext({
    features: [],
    loading: false,
    tenantId: null,
    environment:
      process.env.NODE_ENV,
  });

// ============================================================================
// Provider
// ============================================================================

export function FeatureProvider({
  children,
  features = [],
  tenantId = null,
  loading = false,
}) {
  const normalized =
    useMemo(() => {
      return Array.from(
        new Set(
          (features || []).map(
            feature =>
              String(
                feature
              ).toLowerCase()
          )
        )
      );
    }, [features]);

  const value =
    useMemo(
      () => ({
        features:
          normalized,
        tenantId,
        loading,
        environment:
          process.env
            .NODE_ENV,
      }),
      [
        normalized,
        tenantId,
        loading,
      ]
    );

  return (
    <FeatureContext.Provider
      value={value}
    >
      {children}
    </FeatureContext.Provider>
  );
}

FeatureProvider.propTypes = {
  children:
    PropTypes.node
      .isRequired,
  features:
    PropTypes.array,
  tenantId:
    PropTypes.string,
  loading:
    PropTypes.bool,
};

// ============================================================================
// Helpers
// ============================================================================

function normalize(
  feature
) {
  return String(feature)
    .trim()
    .toLowerCase();
}

function toArray(
  features
) {
  if (!features) {
    return [];
  }

  if (
    Array.isArray(features)
  ) {
    return features;
  }

  return [features];
}

// ============================================================================
// Hooks
// ============================================================================

export function useFeatureContext() {
  return useContext(
    FeatureContext
  );
}

export function useFeature(
  feature,
  enabledFeatures
) {
  const context =
    useFeatureContext();

  const available =
    enabledFeatures ||
    context.features;

  return useMemo(() => {
    return (
      available || []
    )
      .map(normalize)
      .includes(
        normalize(
          feature
        )
      );
  }, [
    feature,
    available,
  ]);
}

export function useFeatures(
  features,
  enabledFeatures,
  options = {}
) {
  const context =
    useFeatureContext();

  const available =
    enabledFeatures ||
    context.features;

  const requireAll =
    options.requireAll ===
    true;

  return useMemo(() => {
    const requested =
      toArray(
        features
      ).map(
        normalize
      );

    const enabled =
      (available || []).map(
        normalize
      );

    if (
      requested.length ===
      0
    ) {
      return true;
    }

    if (requireAll) {
      return requested.every(
        feature =>
          enabled.includes(
            feature
          )
      );
    }

    return requested.some(
      feature =>
        enabled.includes(
          feature
        )
    );
  }, [
    features,
    available,
    requireAll,
  ]);
}

// ============================================================================
// Main Component
// ============================================================================

function FeatureGate({
  children,
  features,
  enabledFeatures,
  requireAll = false,
  fallback = null,
  loadingComponent = null,
  invert = false,
  onAllow,
  onDeny,
  audit = false,
}) {
  const context =
    useFeatureContext();

  const previous =
    useRef(null);

  const allowed =
    useFeatures(
      features,
      enabledFeatures,
      {
        requireAll,
      }
    );

  const finalResult =
    invert
      ? !allowed
      : allowed;

  const currentFeatures =
    enabledFeatures ||
    context.features;

  // ===========================================================
  // Side Effects
  // ===========================================================

  useEffect(() => {
    if (
      previous.current ===
      finalResult
    ) {
      return;
    }

    previous.current =
      finalResult;

    if (finalResult) {
      onAllow?.();
    } else {
      onDeny?.();
    }

    if (audit) {
      const payload = {
        features:
          toArray(
            features
          ),
        allowed:
          finalResult,
        tenantId:
          context.tenantId,
        timestamp:
          new Date().toISOString(),
      };

      if (
        process.env
          .NODE_ENV !==
        "production"
      ) {
        console.debug(
          "[FeatureGate]",
          payload
        );
      }
    }
  }, [
    finalResult,
    features,
    context.tenantId,
    onAllow,
    onDeny,
    audit,
  ]);

  // ===========================================================
  // Loading
  // ===========================================================

  if (
    context.loading
  ) {
    return (
      loadingComponent ||
      null
    );
  }

  // ===========================================================
  // Access Denied
  // ===========================================================

  if (!finalResult) {
    return fallback;
  }

  // ===========================================================
  // Access Granted
  // ===========================================================

  return (
    <>
      {children}
    </>
  );
}

// ============================================================================
// Enterprise Utilities
// ============================================================================

FeatureGate.hasFeature =
  (
    feature,
    enabledFeatures = []
  ) => {
    return (
      enabledFeatures
        .map(normalize)
        .includes(
          normalize(
            feature
          )
        )
    );
  };

FeatureGate.hasFeatures =
  (
    features,
    enabledFeatures = [],
    options = {}
  ) => {
    const requested =
      toArray(
        features
      ).map(
        normalize
      );

    const available =
      enabledFeatures.map(
        normalize
      );

    const requireAll =
      options.requireAll ===
      true;

    if (requireAll) {
      return requested.every(
        feature =>
          available.includes(
            feature
          )
      );
    }

    return requested.some(
      feature =>
        available.includes(
          feature
        )
    );
  };

FeatureGate.filter =
  (
    items = [],
    featureKey =
      "feature",
    enabledFeatures = []
  ) => {
    return items.filter(
      item =>
        !item[
          featureKey
        ] ||
        FeatureGate.hasFeature(
          item[
            featureKey
          ],
          enabledFeatures
        )
    );
  };

FeatureGate.registry =
  FEATURES;

// ============================================================================
// HOC
// ============================================================================

export function withFeature(
  WrappedComponent,
  options = {}
) {
  const {
    features,
    requireAll,
    fallback,
  } = options;

  function Component(
    props
  ) {
    return (
      <FeatureGate
        features={
          features
        }
        requireAll={
          requireAll
        }
        fallback={
          fallback
        }
      >
        <WrappedComponent
          {...props}
        />
      </FeatureGate>
    );
  }

  Component.displayName = `withFeature(${
    WrappedComponent.displayName ||
    WrappedComponent.name ||
    "Component"
  })`;

  return Component;
}

// ============================================================================
// PropTypes
// ============================================================================

FeatureGate.propTypes = {
  children:
    PropTypes.node,
  features:
    PropTypes.oneOfType(
      [
        PropTypes.string,
        PropTypes.arrayOf(
          PropTypes.string
        ),
      ]
    )
      .isRequired,
  enabledFeatures:
    PropTypes.array,
  requireAll:
    PropTypes.bool,
  fallback:
    PropTypes.node,
  loadingComponent:
    PropTypes.node,
  invert:
    PropTypes.bool,
  onAllow:
    PropTypes.func,
  onDeny:
    PropTypes.func,
  audit:
    PropTypes.bool,
};

// ============================================================================
// Export
// ============================================================================

export default React.memo(
  FeatureGate
);