// frontend/src/pages/Loans.jsx
// ============================================================================
// TITech Community Capital
// Loans Management
// File: src/pages/Loans.jsx
// Production Grade
// ============================================================================

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Search,
  RefreshCw,
  AlertCircle,
  CreditCard,
  Plus,
  Eye,
  Edit,
  CheckCircle,
  Clock,
  XCircle,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import api from "../services/api";
import { useAuth } from "../context/AuthContext";

import "./Loans.css";

// ============================================================================
// Constants
// ============================================================================

const PAGE_SIZE = 10;
const AUTO_REFRESH_INTERVAL = 60000;

const STATUS_OPTIONS = [
  "all",
  "pending",
  "approved",
  "active",
  "completed",
  "rejected",
  "defaulted",
];

// ============================================================================
// Helpers
// ============================================================================

function formatCurrency(value) {
  return new Intl.NumberFormat(
    "en-UG",
    {
      style: "currency",
      currency: "UGX",
      maximumFractionDigits: 0,
    }
  ).format(Number(value || 0));
}

function formatDate(date) {
  if (!date) return "-";

  try {
    return new Date(
      date
    ).toLocaleDateString();
  } catch {
    return "-";
  }
}

// ============================================================================
// Status Badge
// ============================================================================

function LoanStatusBadge({
  status,
}) {
  const normalized =
    (status || "pending")
      .toLowerCase();

  return (
    <span
      className={`loan-status loan-status-${normalized}`}
    >
      {status}
    </span>
  );
}

// ============================================================================
// Stats Card
// ============================================================================

function StatsCard({
  title,
  value,
  icon: Icon,
}) {
  return (
    <div className="loan-stat-card">
      <div className="loan-stat-icon">
        <Icon size={24} />
      </div>

      <div>
        <h4>{title}</h4>
        <p>{value}</p>
      </div>
    </div>
  );
}

// ============================================================================
// Skeleton
// ============================================================================

function LoanSkeleton() {
  return (
    <tr>
      <td colSpan={8}>
        <div className="loan-skeleton" />
      </td>
    </tr>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function Loans() {
  const navigate =
    useNavigate();

  const { user } =
    useAuth();

  const mountedRef =
    useRef(false);

  const refreshRef =
    useRef();

  const [loading, setLoading] =
    useState(true);

  const [loans, setLoans] =
    useState([]);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("all");

  const [page, setPage] =
    useState(1);

  // ===========================================================================
  // Permissions
  // ===========================================================================

  const isAdmin =
    useMemo(() => {
      return [
        "admin",
        "ADMIN",
        "super_admin",
        "loan_officer",
      ].includes(
        user?.role
      );
    }, [user]);

  // ===========================================================================
  // Fetch Loans
  // ===========================================================================

  const fetchLoans =
    useCallback(async () => {
      try {
        setError("");

        const response =
          await api.get(
            "/api/loans"
          );

        const data =
          response?.data ||
          response ||
          [];

        if (mountedRef.current) {
          setLoans(
            Array.isArray(
              data
            )
              ? data
              : []
          );
        }
      } catch (err) {
        console.error(err);

        if (mountedRef.current) {
          setError(
            err?.response?.data
              ?.message ||
              "Failed to load loans."
          );
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    }, []);

  // ===========================================================================
  // Initialize
  // ===========================================================================

  useEffect(() => {
    mountedRef.current = true;

    fetchLoans();

    refreshRef.current =
      setInterval(
        fetchLoans,
        AUTO_REFRESH_INTERVAL
      );

    return () => {
      mountedRef.current = false;

      clearInterval(
        refreshRef.current
      );
    };
  }, [fetchLoans]);

  // ===========================================================================
  // Filtering
  // ===========================================================================

  const filteredLoans =
    useMemo(() => {
      return loans.filter(
        (loan) => {
          const matchesSearch =
            !search ||
            loan?.memberName
              ?.toLowerCase()
              .includes(
                search.toLowerCase()
              ) ||
            loan?.loanNumber
              ?.toLowerCase()
              .includes(
                search.toLowerCase()
              );

          const matchesStatus =
            statusFilter ===
              "all" ||
            loan?.status ===
              statusFilter;

          return (
            matchesSearch &&
            matchesStatus
          );
        }
      );
    }, [
      loans,
      search,
      statusFilter,
    ]);

  // ===========================================================================
  // Pagination
  // ===========================================================================

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredLoans.length /
          PAGE_SIZE
      )
    );

  const paginatedLoans =
    useMemo(() => {
      const start =
        (page - 1) *
        PAGE_SIZE;

      return filteredLoans.slice(
        start,
        start + PAGE_SIZE
      );
    }, [
      filteredLoans,
      page,
    ]);

  // ===========================================================================
  // Portfolio Statistics
  // ===========================================================================

  const stats =
    useMemo(() => {
      const totalAmount =
        loans.reduce(
          (
            sum,
            loan
          ) =>
            sum +
            Number(
              loan.amount ||
                0
            ),
          0
        );

      const active =
        loans.filter(
          (l) =>
            l.status ===
            "active"
        ).length;

      const pending =
        loans.filter(
          (l) =>
            l.status ===
            "pending"
        ).length;

      const defaulted =
        loans.filter(
          (l) =>
            l.status ===
            "defaulted"
        ).length;

      return {
        totalLoans:
          loans.length,
        totalAmount,
        active,
        pending,
        defaulted,
      };
    }, [loans]);

  // ===========================================================================
  // Retry
  // ===========================================================================

  const handleRetry =
    useCallback(() => {
      setLoading(true);
      fetchLoans();
    }, [fetchLoans]);

  // ===========================================================================
  // Approve Loan
  // ===========================================================================

  const approveLoan =
    useCallback(
      async (loanId) => {
        try {
          await api.post(
            `/api/loans/${loanId}/approve`
          );

          toast.success(
            "Loan approved."
          );

          fetchLoans();
        } catch (err) {
          toast.error(
            err?.response
              ?.data
              ?.message ||
              "Approval failed."
          );
        }
      },
      [fetchLoans]
    );

  // ===========================================================================
  // Loading
  // ===========================================================================

  if (loading) {
    return (
      <div className="loans-page">
        <table className="loans-table">
          <tbody>
            <LoanSkeleton />
            <LoanSkeleton />
            <LoanSkeleton />
          </tbody>
        </table>
      </div>
    );
  }

  // ===========================================================================
  // Render
  // ===========================================================================

  return (
    <div className="loans-page">
      <header className="loans-header">
        <div>
          <h1>
            Loan Portfolio
          </h1>

          <p>
            Manage member
            loans and
            repayments.
          </p>
        </div>

        {isAdmin && (
          <button
            className="primary-btn"
            onClick={() =>
              navigate(
                "/loans/new"
              )
            }
          >
            <Plus size={18} />
            New Loan
          </button>
        )}
      </header>

      <section className="loan-stats">
        <StatsCard
          title="Loans"
          value={
            stats.totalLoans
          }
          icon={CreditCard}
        />

        <StatsCard
          title="Portfolio"
          value={formatCurrency(
            stats.totalAmount
          )}
          icon={CreditCard}
        />

        <StatsCard
          title="Active"
          value={
            stats.active
          }
          icon={
            CheckCircle
          }
        />

        <StatsCard
          title="Pending"
          value={
            stats.pending
          }
          icon={Clock}
        />

        <StatsCard
          title="Defaulted"
          value={
            stats.defaulted
          }
          icon={XCircle}
        />
      </section>

      <section className="loan-filters">
        <div className="search-box">
          <Search size={18} />

          <input
            type="text"
            placeholder="Search loans..."
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
          />
        </div>

        <select
          value={
            statusFilter
          }
          onChange={(e) =>
            setStatusFilter(
              e.target.value
            )
          }
        >
          {STATUS_OPTIONS.map(
            (
              status
            ) => (
              <option
                key={status}
                value={status}
              >
                {status}
              </option>
            )
          )}
        </select>
      </section>

      {error && (
        <div className="error-box">
          <AlertCircle />

          <p>{error}</p>

          <button
            onClick={
              handleRetry
            }
          >
            <RefreshCw
              size={16}
            />
            Retry
          </button>
        </div>
      )}

      <div className="loans-table-wrapper">
        <table className="loans-table">
          <thead>
            <tr>
              <th>
                Loan #
              </th>
              <th>
                Member
              </th>
              <th>
                Amount
              </th>
              <th>
                Balance
              </th>
              <th>
                Status
              </th>
              <th>
                Created
              </th>
              <th>
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {paginatedLoans.map(
              (loan) => (
                <tr
                  key={
                    loan._id
                  }
                >
                  <td>
                    {
                      loan.loanNumber
                    }
                  </td>

                  <td>
                    {
                      loan.memberName
                    }
                  </td>

                  <td>
                    {formatCurrency(
                      loan.amount
                    )}
                  </td>

                  <td>
                    {formatCurrency(
                      loan.balance
                    )}
                  </td>

                  <td>
                    <LoanStatusBadge
                      status={
                        loan.status
                      }
                    />
                  </td>

                  <td>
                    {formatDate(
                      loan.createdAt
                    )}
                  </td>

                  <td>
                    <div className="action-buttons">
                      <button
                        onClick={() =>
                          navigate(
                            `/loans/${loan._id}`
                          )
                        }
                      >
                        <Eye
                          size={16}
                        />
                      </button>

                      {isAdmin && (
                        <>
                          <button
                            onClick={() =>
                              navigate(
                                `/loans/${loan._id}/edit`
                              )
                            }
                          >
                            <Edit
                              size={16}
                            />
                          </button>

                          {loan.status ===
                            "pending" && (
                            <button
                              onClick={() =>
                                approveLoan(
                                  loan._id
                                )
                              }
                            >
                              <CheckCircle
                                size={
                                  16
                                }
                              />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>

      <footer className="pagination">
        <button
          disabled={
            page === 1
          }
          onClick={() =>
            setPage(
              (p) =>
                p - 1
            )
          }
        >
          Previous
        </button>

        <span>
          Page {page} of{" "}
          {totalPages}
        </span>

        <button
          disabled={
            page ===
            totalPages
          }
          onClick={() =>
            setPage(
              (p) =>
                p + 1
            )
          }
        >
          Next
        </button>
      </footer>
    </div>
  );
}