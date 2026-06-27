// ============================================================================
// TITech Community Capital
// frontend/src/pages/AdminRiskDashboard.jsx
// Enterprise Risk Intelligence Dashboard
// Production Grade
// ============================================================================

import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";

import { Line, Bar, Pie } from "react-chartjs-2";

import {
  Shield,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  RefreshCw,
  Activity,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import api from "../services/api";
import { useAuth } from "../context/AuthContext";

import "./AdminRiskDashboard.css";

// ============================================================================
// CHART REGISTRATION
// ============================================================================

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend
);

// ============================================================================
// COMPONENT
// ============================================================================

export default function AdminRiskDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const mountedRef = useRef(true);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [riskProfiles, setRiskProfiles] = useState([]);
  const [fraudLogs, setFraudLogs] = useState([]);
  const [portfolio, setPortfolio] = useState({});

  const [error, setError] = useState("");

  // ==========================================================================
  // RBAC
  // ==========================================================================

  useEffect(() => {
    if (
      user &&
      !["admin", "risk_manager", "auditor"].includes(user.role)
    ) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  // ==========================================================================
  // DATA LOADER
  // ==========================================================================

  const loadDashboard = useCallback(async () => {
    try {
      setError("");

      const [riskRes, fraudRes, portfolioRes] =
        await Promise.all([
          api.get("/api/risk/profiles"),
          api.get("/api/fraud/logs"),
          api.get("/api/admin/portfolio"),
        ]);

      if (!mountedRef.current) return;

      setRiskProfiles(riskRes.data?.data || []);
      setFraudLogs(fraudRes.data?.data || []);
      setPortfolio(portfolioRes.data?.data || {});
    } catch (err) {
      console.error(err);

      if (!mountedRef.current) return;

      const message =
        err?.response?.data?.message ||
        "Failed to load dashboard";

      setError(message);

      toast.error(message);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  // ==========================================================================
  // INITIAL LOAD
  // ==========================================================================

  useEffect(() => {
    mountedRef.current = true;

    loadDashboard();

    const interval = setInterval(() => {
      loadDashboard();
    }, 60000);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [loadDashboard]);

  // ==========================================================================
  // KPI CALCULATIONS
  // ==========================================================================

  const metrics = useMemo(() => {
    const lowRisk = riskProfiles.filter(
      (r) => r.riskLevel === "APPROVE"
    ).length;

    const mediumRisk = riskProfiles.filter(
      (r) => r.riskLevel === "REVIEW"
    ).length;

    const highRisk = riskProfiles.filter(
      (r) => r.riskLevel === "REJECT"
    ).length;

    const averageFraudScore =
      fraudLogs.length > 0
        ? (
            fraudLogs.reduce(
              (sum, item) =>
                sum + (item.fraudScore || 0),
              0
            ) / fraudLogs.length
          ).toFixed(1)
        : 0;

    return {
      lowRisk,
      mediumRisk,
      highRisk,
      averageFraudScore,
    };
  }, [riskProfiles, fraudLogs]);

  // ==========================================================================
  // CHART DATA
  // ==========================================================================

  const riskDistribution = useMemo(
    () => ({
      labels: [
        "Low Risk",
        "Medium Risk",
        "High Risk",
      ],
      datasets: [
        {
          data: [
            metrics.lowRisk,
            metrics.mediumRisk,
            metrics.highRisk,
          ],
          backgroundColor: [
            "#10B981",
            "#F59E0B",
            "#EF4444",
          ],
        },
      ],
    }),
    [metrics]
  );

  const fraudTrendData = useMemo(
    () => ({
      labels: fraudLogs.map((f) =>
        new Date(f.createdAt).toLocaleDateString()
      ),
      datasets: [
        {
          label: "Fraud Score",
          data: fraudLogs.map(
            (f) => f.fraudScore || 0
          ),
          borderColor: "#EF4444",
          backgroundColor: "#EF4444",
          tension: 0.3,
        },
      ],
    }),
    [fraudLogs]
  );

  const portfolioData = useMemo(
    () => ({
      labels: [
        "Loans",
        "Defaults",
        "Active",
      ],
      datasets: [
        {
          label: "Portfolio",
          data: [
            portfolio.totalLoans || 0,
            portfolio.defaults || 0,
            portfolio.activeLoans || 0,
          ],
          backgroundColor: [
            "#2563EB",
            "#EF4444",
            "#10B981",
          ],
        },
      ],
    }),
    [portfolio]
  );

  // ==========================================================================
  // REFRESH
  // ==========================================================================

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
  };

  // ==========================================================================
  // LOADING
  // ==========================================================================

  if (loading) {
    return (
      <div className="risk-loading">
        <div className="risk-spinner" />
        <h3>Loading Risk Intelligence...</h3>
      </div>
    );
  }

  // ==========================================================================
  // UI
  // ==========================================================================

  return (
    <div className="risk-dashboard">

      <div className="risk-header">
        <div>
          <h1>Risk Intelligence Dashboard</h1>
          <p>
            Enterprise Risk & Fraud Monitoring
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="refresh-btn"
        >
          <RefreshCw size={18} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="risk-error">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      {/* KPI CARDS */}

      <div className="risk-kpis">

        <div className="risk-card">
          <Shield size={28} />
          <h3>{metrics.lowRisk}</h3>
          <p>Low Risk</p>
        </div>

        <div className="risk-card">
          <AlertTriangle size={28} />
          <h3>{metrics.mediumRisk}</h3>
          <p>Review Required</p>
        </div>

        <div className="risk-card">
          <TrendingUp size={28} />
          <h3>{metrics.highRisk}</h3>
          <p>High Risk</p>
        </div>

        <div className="risk-card">
          <Activity size={28} />
          <h3>{metrics.averageFraudScore}</h3>
          <p>Avg Fraud Score</p>
        </div>

        <div className="risk-card">
          <DollarSign size={28} />
          <h3>
            {(portfolio.totalLoans || 0).toLocaleString()}
          </h3>
          <p>Total Loans</p>
        </div>

      </div>

      {/* CHARTS */}

      <div className="risk-grid">

        <div className="chart-card">
          <h3>Credit Risk Distribution</h3>
          <Pie data={riskDistribution} />
        </div>

        <div className="chart-card">
          <h3>Fraud Trends</h3>
          <Line data={fraudTrendData} />
        </div>

      </div>

      <div className="chart-card full-width">
        <h3>Portfolio Overview</h3>
        <Bar data={portfolioData} />
      </div>

    </div>
  );
}