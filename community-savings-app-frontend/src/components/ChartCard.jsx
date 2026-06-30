/**
 * ============================================================================
 * TITech Community Capital
 * Enterprise Chart Card Component
 * File: frontend/src/components/ChartCard.jsx
 * Production Grade
 * ============================================================================
 *
 * Features
 * --------
 * ✓ Responsive Container
 * ✓ Loading State
 * ✓ Empty State
 * ✓ Error State
 * ✓ Fullscreen Support
 * ✓ Export to PNG
 * ✓ Export to CSV
 * ✓ Refresh Button
 * ✓ Theme Support
 * ✓ React 18 Ready
 * ============================================================================
 */

import React, {
  memo,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";

import PropTypes from "prop-types";

import {
  Download,
  Expand,
  Minimize2,
  RefreshCw,
  AlertCircle,
  FileSpreadsheet,
} from "lucide-react";

import "./ChartCard.css";

// ============================================================================
// Helpers
// ============================================================================

function downloadCSV(
  filename,
  data = []
) {
  if (!Array.isArray(data)) return;

  const headers = Object.keys(
    data[0] || {}
  );

  const rows = data.map((item) =>
    headers.map(
      (key) => item[key]
    )
  );

  const csv = [
    headers.join(","),
    ...rows.map((r) =>
      r.join(",")
    ),
  ].join("\n");

  const blob = new Blob(
    [csv],
    {
      type: "text/csv",
    }
  );

  const url =
    window.URL.createObjectURL(
      blob
    );

  const link =
    document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  window.URL.revokeObjectURL(
    url
  );
}

async function downloadPNG(
  element,
  filename
) {
  try {
    const html2canvas =
      (
        await import(
          "html2canvas"
        )
      ).default;

    const canvas =
      await html2canvas(
        element
      );

    const link =
      document.createElement(
        "a"
      );

    link.download =
      filename;

    link.href =
      canvas.toDataURL();

    link.click();
  } catch (err) {
    console.error(
      "Failed to export chart",
      err
    );
  }
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState({
  message,
}) {
  return (
    <div className="chart-empty">
      <AlertCircle
        size={40}
      />

      <p>{message}</p>
    </div>
  );
}

// ============================================================================
// Loading State
// ============================================================================

function LoadingState() {
  return (
    <div className="chart-loading">
      <div className="chart-loader" />
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

function ChartCard({
  title,
  subtitle,
  children,
  data = [],
  loading = false,
  error = null,
  onRefresh,
  className = "",
  exportable = true,
  refreshable = true,
  emptyMessage = "No data available.",
  footer,
  height = 360,
}) {
  const cardRef =
    useRef(null);

  const [
    fullscreen,
    setFullscreen,
  ] = useState(false);

  const hasData =
    useMemo(() => {
      return (
        Array.isArray(
          data
        ) &&
        data.length > 0
      );
    }, [data]);

  // ===========================================================================
  // Handlers
  // ===========================================================================

  const handlePNGExport =
    useCallback(() => {
      if (!cardRef.current)
        return;

      downloadPNG(
        cardRef.current,
        `${title}.png`
      );
    }, [title]);

  const handleCSVExport =
    useCallback(() => {
      downloadCSV(
        `${title}.csv`,
        data
      );
    }, [title, data]);

  const toggleFullscreen =
    useCallback(() => {
      setFullscreen(
        (previous) =>
          !previous
      );
    }, []);

  // ===========================================================================
  // Render Body
  // ===========================================================================

  const renderContent =
    () => {
      if (loading) {
        return (
          <LoadingState />
        );
      }

      if (error) {
        return (
          <EmptyState
            message={
              typeof error ===
              "string"
                ? error
                : "Unable to load chart."
            }
          />
        );
      }

      if (!hasData) {
        return (
          <EmptyState
            message={
              emptyMessage
            }
          />
        );
      }

      return children;
    };

  // ===========================================================================
  // Render
  // ===========================================================================

  return (
    <div
      ref={cardRef}
      className={`chart-card ${className} ${
        fullscreen
          ? "fullscreen"
          : ""
      }`}
    >
      {/* Header */}
      <div className="chart-card-header">
        <div>
          <h3 className="chart-card-title">
            {title}
          </h3>

          {subtitle && (
            <p className="chart-card-subtitle">
              {subtitle}
            </p>
          )}
        </div>

        <div className="chart-card-actions">
          {refreshable &&
            onRefresh && (
              <button
                className="chart-action-btn"
                onClick={
                  onRefresh
                }
                title="Refresh"
              >
                <RefreshCw
                  size={18}
                />
              </button>
            )}

          {exportable &&
            hasData && (
              <>
                <button
                  className="chart-action-btn"
                  onClick={
                    handleCSVExport
                  }
                  title="Export CSV"
                >
                  <FileSpreadsheet
                    size={18}
                  />
                </button>

                <button
                  className="chart-action-btn"
                  onClick={
                    handlePNGExport
                  }
                  title="Export PNG"
                >
                  <Download
                    size={18}
                  />
                </button>
              </>
            )}

          <button
            className="chart-action-btn"
            onClick={
              toggleFullscreen
            }
            title="Fullscreen"
          >
            {fullscreen ? (
              <Minimize2
                size={18}
              />
            ) : (
              <Expand
                size={18}
              />
            )}
          </button>
        </div>
      </div>

      {/* Body */}
      <div
        className="chart-card-body"
        style={{
          height,
        }}
      >
        {renderContent()}
      </div>

      {/* Footer */}
      {footer && (
        <div className="chart-card-footer">
          {footer}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Prop Types
// ============================================================================

ChartCard.propTypes = {
  title:
    PropTypes.string
      .isRequired,

  subtitle:
    PropTypes.string,

  children:
    PropTypes.node,

  data:
    PropTypes.array,

  loading:
    PropTypes.bool,

  error:
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.object,
    ]),

  onRefresh:
    PropTypes.func,

  className:
    PropTypes.string,

  exportable:
    PropTypes.bool,

  refreshable:
    PropTypes.bool,

  emptyMessage:
    PropTypes.string,

  footer:
    PropTypes.node,

  height:
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number,
    ]),
};

ChartCard.defaultProps = {
  data: [],
  loading: false,
  exportable: true,
  refreshable: true,
  emptyMessage:
    "No chart data available.",
  height: 360,
};

// ============================================================================
// Export
// ============================================================================

export default memo(
  ChartCard
);