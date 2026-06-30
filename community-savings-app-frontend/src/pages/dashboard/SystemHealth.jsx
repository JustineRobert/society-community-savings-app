// ============================================================================
// TITech Community Capital
// System Health Dashboard
// File: frontend/src/pages/SystemHealth.jsx
// Production Grade
// ============================================================================

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  HardDrive,
  Network,
  RefreshCw,
  Server,
  Shield,
  WifiOff,
} from "lucide-react";

import api from "../services/api";

import {
  Card,
  Button,
  LoadingScreen,
  StatusBadge,
  PageHeader,
} from "../ui";

import "./SystemHealth.css";

// ============================================================================
// Constants
// ============================================================================

const AUTO_REFRESH_INTERVAL = 30000;

const DEFAULT_HEALTH = {
  status: "healthy",
  uptime: 0,
  memory: {
    used: 0,
    total: 0,
    percentage: 0,
  },
  cpu: {
    usage: 0,
  },
  database: {
    status: "healthy",
    latency: 0,
  },
  redis: {
    status: "healthy",
    latency: 0,
  },
  services: [],
  metrics: {
    requestsPerMinute: 0,
    activeUsers: 0,
    errorRate: 0,
  },
};

// ============================================================================
// Helpers
// ============================================================================

function formatBytes(bytes) {
  if (!bytes) return "0 MB";

  const units = [
    "Bytes",
    "KB",
    "MB",
    "GB",
    "TB",
  ];

  const index = Math.floor(
    Math.log(bytes) /
      Math.log(1024)
  );

  return `${(
    bytes /
    Math.pow(
      1024,
      index
    )
  ).toFixed(2)} ${
    units[index]
  }`;
}

function formatUptime(
  seconds
) {
  if (!seconds)
    return "0m";

  const days =
    Math.floor(
      seconds / 86400
    );

  const hours =
    Math.floor(
      (seconds %
        86400) /
        3600
    );

  const minutes =
    Math.floor(
      (seconds %
        3600) /
        60
    );

  return `${days}d ${hours}h ${minutes}m`;
}

function getStatusVariant(
  status
) {
  switch (
    status?.toLowerCase()
  ) {
    case "healthy":
      return "success";
    case "warning":
      return "warning";
    case "degraded":
      return "warning";
    case "critical":
      return "danger";
    case "offline":
      return "danger";
    default:
      return "secondary";
  }
}

// ============================================================================
// Progress Bar
// ============================================================================

function ProgressBar({
  value,
  color = "#2563eb",
}) {
  return (
    <div className="health-progress">
      <div
        className="health-progress-fill"
        style={{
          width: `${Math.min(
            value,
            100
          )}%`,
          background:
            color,
        }}
      />
    </div>
  );
}

// ============================================================================
// System Health Page
// ============================================================================

export default function SystemHealth() {
  const [
    health,
    setHealth,
  ] = useState(
    DEFAULT_HEALTH
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  // ===========================================================================
  // Fetch Health
  // ===========================================================================

  const loadHealth =
    useCallback(
      async (
        silent = false
      ) => {
        try {
          if (!silent) {
            setRefreshing(
              true
            );
          }

          setError("");

          const response =
            await api.get(
              "/api/system/health"
            );

          const data =
            response.data ||
            DEFAULT_HEALTH;

          setHealth({
            ...DEFAULT_HEALTH,
            ...data,
          });
        } catch (
          err
        ) {
          setError(
            err?.response
              ?.data
              ?.message ||
              "Failed to load system health."
          );
        } finally {
          setLoading(
            false
          );
          setRefreshing(
            false
          );
        }
      },
      []
    );

  // ===========================================================================
  // Initialize
  // ===========================================================================

  useEffect(() => {
    loadHealth();

    const timer =
      setInterval(
        () =>
          loadHealth(
            true
          ),
        AUTO_REFRESH_INTERVAL
      );

    return () =>
      clearInterval(
        timer
      );
  }, [loadHealth]);

  // ===========================================================================
  // Computed
  // ===========================================================================

  const systemHealthy =
    useMemo(() => {
      return (
        health.status ===
        "healthy"
      );
    }, [health]);

  // ===========================================================================
  // Loading
  // ===========================================================================

  if (loading) {
    return <LoadingScreen />;
  }

  // ===========================================================================
  // Render
  // ===========================================================================

  return (
    <div className="system-health-page">
      <PageHeader
        title="System Health"
        subtitle="Monitor infrastructure, services and platform availability."
        actions={
          <Button
            onClick={() =>
              loadHealth()
            }
            disabled={
              refreshing
            }
          >
            <RefreshCw
              size={18}
            />
            Refresh
          </Button>
        }
      />

      {/* ================================================================ */}
      {/* Overall Status */}
      {/* ================================================================ */}

      <Card className="system-status-card">
        <div className="system-status-header">
          <div>
            <h2>
              Platform Status
            </h2>

            <p>
              Current system
              operational
              health.
            </p>
          </div>

          <StatusBadge
            status={getStatusVariant(
              health.status
            )}
          >
            {health.status}
          </StatusBadge>
        </div>

        <div className="system-status-body">
          {systemHealthy ? (
            <CheckCircle2
              size={60}
              className="status-icon healthy"
            />
          ) : (
            <AlertTriangle
              size={60}
              className="status-icon unhealthy"
            />
          )}

          <div>
            <h3>
              {systemHealthy
                ? "All Systems Operational"
                : "Attention Required"}
            </h3>

            <p>
              Uptime:{" "}
              {formatUptime(
                health.uptime
              )}
            </p>
          </div>
        </div>
      </Card>

      {error && (
        <Card className="system-error-card">
          <WifiOff />
          <span>
            {error}
          </span>
        </Card>
      )}

      {/* ================================================================ */}
      {/* Metrics */}
      {/* ================================================================ */}

      <section className="health-grid">
        <Card className="metric-card">
          <Cpu
            size={28}
          />

          <h3>
            CPU Usage
          </h3>

          <h2>
            {
              health.cpu
                ?.usage
            }
            %
          </h2>

          <ProgressBar
            value={
              health.cpu
                ?.usage
            }
            color="#2563eb"
          />
        </Card>

        <Card className="metric-card">
          <HardDrive
            size={28}
          />

          <h3>
            Memory Usage
          </h3>

          <h2>
            {
              health.memory
                ?.percentage
            }
            %
          </h2>

          <ProgressBar
            value={
              health.memory
                ?.percentage
            }
            color="#10b981"
          />

          <small>
            {formatBytes(
              health.memory
                ?.used
            )}
            {" / "}
            {formatBytes(
              health.memory
                ?.total
            )}
          </small>
        </Card>

        <Card className="metric-card">
          <Activity
            size={28}
          />

          <h3>
            Requests/Min
          </h3>

          <h2>
            {
              health
                .metrics
                ?.requestsPerMinute
            }
          </h2>
        </Card>

        <Card className="metric-card">
          <Shield
            size={28}
          />

          <h3>
            Error Rate
          </h3>

          <h2>
            {
              health
                .metrics
                ?.errorRate
            }
            %
          </h2>
        </Card>

        <Card className="metric-card">
          <Clock
            size={28}
          />

          <h3>
            Active Users
          </h3>

          <h2>
            {
              health
                .metrics
                ?.activeUsers
            }
          </h2>
        </Card>
      </section>

      {/* ================================================================ */}
      {/* Dependencies */}
      {/* ================================================================ */}

      <section className="dependency-grid">
        <Card className="dependency-card">
          <Database />

          <div>
            <h3>
              Database
            </h3>

            <p>
              Latency:{" "}
              {
                health
                  .database
                  ?.latency
              }
              ms
            </p>
          </div>

          <StatusBadge
            status={getStatusVariant(
              health
                .database
                ?.status
            )}
          >
            {
              health
                .database
                ?.status
            }
          </StatusBadge>
        </Card>

        <Card className="dependency-card">
          <Network />

          <div>
            <h3>
              Redis Cache
            </h3>

            <p>
              Latency:{" "}
              {
                health.redis
                  ?.latency
              }
              ms
            </p>
          </div>

          <StatusBadge
            status={getStatusVariant(
              health.redis
                ?.status
            )}
          >
            {
              health.redis
                ?.status
            }
          </StatusBadge>
        </Card>
      </section>

      {/* ================================================================ */}
      {/* Microservices */}
      {/* ================================================================ */}

      <Card>
        <div className="services-header">
          <Server />

          <h2>
            Microservices
          </h2>
        </div>

        <div className="services-list">
          {health.services
            ?.length ? (
            health.services.map(
              (
                service
              ) => (
                <div
                  key={
                    service.name
                  }
                  className="service-item"
                >
                  <div>
                    <h4>
                      {
                        service.name
                      }
                    </h4>

                    <p>
                      Latency:
                      {" "}
                      {
                        service.latency
                      }
                      ms
                    </p>
                  </div>

                  <StatusBadge
                    status={getStatusVariant(
                      service.status
                    )}
                  >
                    {
                      service.status
                    }
                  </StatusBadge>
                </div>
              )
            )
          ) : (
            <div className="empty-services">
              No registered
              services.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}