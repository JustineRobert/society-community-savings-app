// frontend/src/pages/Transactions.jsx
// ============================================================================
// TITech Community Capital
// Transactions Management
// File: src/pages/Transactions.jsx
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
  ArrowDownCircle,
  ArrowUpCircle,
  CreditCard,
  Wallet,
  Eye,
  Download,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import api from "../services/api";

import "./Transactions.css";

// ============================================================================
// Constants
// ============================================================================

const PAGE_SIZE = 15;
const AUTO_REFRESH_INTERVAL = 60000;

const TRANSACTION_TYPES = [
  "all",
  "deposit",
  "withdrawal",
  "loan_disbursement",
  "loan_repayment",
  "transfer",
  "fee",
  "adjustment",
];

const TRANSACTION_STATUSES = [
  "all",
  "pending",
  "processing",
  "completed",
  "failed",
  "reversed",
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

function formatDate(value) {
  if (!value) return "-";

  try {
    return new Date(
      value
    ).toLocaleString();
  } catch {
    return "-";
  }
}

// ============================================================================
// Status Badge
// ============================================================================

function StatusBadge({
  status,
}) {
  const normalized =
    (status || "pending")
      .toLowerCase();

  return (
    <span
      className={`transaction-status transaction-status-${normalized}`}
    >
      {status}
    </span>
  );
}

// ============================================================================
// Type Badge
// ============================================================================

function TypeBadge({
  type,
}) {
  const normalized =
    (type || "deposit")
      .toLowerCase();

  return (
    <span
      className={`transaction-type transaction-type-${normalized}`}
    >
      {type}
    </span>
  );
}

// ============================================================================
// Statistics Card
// ============================================================================

function StatsCard({
  title,
  value,
  icon: Icon,
}) {
  return (
    <div className="transaction-stat-card">
      <div className="transaction-stat-icon">
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

function TransactionSkeleton() {
  return (
    <tr>
      <td colSpan={9}>
        <div className="transaction-skeleton" />
      </td>
    </tr>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function Transactions() {
  const navigate =
    useNavigate();

  const mountedRef =
    useRef(false);

  const refreshRef =
    useRef();

  const [loading, setLoading] =
    useState(true);

  const [
    transactions,
    setTransactions,
  ] = useState([]);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [
    typeFilter,
    setTypeFilter,
  ] = useState("all");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("all");

  const [page, setPage] =
    useState(1);

  // ===========================================================================
  // Fetch Transactions
  // ===========================================================================

  const fetchTransactions =
    useCallback(async () => {
      try {
        setError("");

        const response =
          await api.get(
            "/api/transactions"
          );

        const data =
          response?.data ||
          response ||
          [];

        if (mountedRef.current) {
          setTransactions(
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
              "Failed to load transactions."
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

    fetchTransactions();

    refreshRef.current =
      setInterval(
        fetchTransactions,
        AUTO_REFRESH_INTERVAL
      );

    return () => {
      mountedRef.current = false;

      clearInterval(
        refreshRef.current
      );
    };
  }, [fetchTransactions]);

  // ===========================================================================
  // Filtering
  // ===========================================================================

  const filteredTransactions =
    useMemo(() => {
      return transactions.filter(
        (tx) => {
          const matchesSearch =
            !search ||
            tx?.reference
              ?.toLowerCase()
              .includes(
                search.toLowerCase()
              ) ||
            tx?.memberName
              ?.toLowerCase()
              .includes(
                search.toLowerCase()
              ) ||
            tx?.phone
              ?.includes(search);

          const matchesType =
            typeFilter ===
              "all" ||
            tx?.type ===
              typeFilter;

          const matchesStatus =
            statusFilter ===
              "all" ||
            tx?.status ===
              statusFilter;

          return (
            matchesSearch &&
            matchesType &&
            matchesStatus
          );
        }
      );
    }, [
      transactions,
      search,
      typeFilter,
      statusFilter,
    ]);

  // ===========================================================================
  // Pagination
  // ===========================================================================

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredTransactions.length /
          PAGE_SIZE
      )
    );

  const paginatedTransactions =
    useMemo(() => {
      const start =
        (page - 1) *
        PAGE_SIZE;

      return filteredTransactions.slice(
        start,
        start + PAGE_SIZE
      );
    }, [
      filteredTransactions,
      page,
    ]);

  // ===========================================================================
  // Statistics
  // ===========================================================================

  const stats =
    useMemo(() => {
      const deposits =
        transactions
          .filter(
            (t) =>
              t.type ===
              "deposit"
          )
          .reduce(
            (
              sum,
              tx
            ) =>
              sum +
              Number(
                tx.amount ||
                  0
              ),
            0
          );

      const withdrawals =
        transactions
          .filter(
            (t) =>
              t.type ===
              "withdrawal"
          )
          .reduce(
            (
              sum,
              tx
            ) =>
              sum +
              Number(
                tx.amount ||
                  0
              ),
            0
          );

      const completed =
        transactions.filter(
          (t) =>
            t.status ===
            "completed"
        ).length;

      return {
        total:
          transactions.length,
        deposits,
        withdrawals,
        completed,
      };
    }, [transactions]);

  // ===========================================================================
  // Retry
  // ===========================================================================

  const handleRetry =
    useCallback(() => {
      setLoading(true);
      fetchTransactions();
    }, [fetchTransactions]);

  // ===========================================================================
  // Export
  // ===========================================================================

  const handleExport =
    useCallback(async () => {
      try {
        await api.get(
          "/api/transactions/export"
        );

        toast.success(
          "Export started."
        );
      } catch {
        toast.error(
          "Unable to export transactions."
        );
      }
    }, []);

  // ===========================================================================
  // Loading
  // ===========================================================================

  if (loading) {
    return (
      <div className="transactions-page">
        <table className="transactions-table">
          <tbody>
            <TransactionSkeleton />
            <TransactionSkeleton />
            <TransactionSkeleton />
          </tbody>
        </table>
      </div>
    );
  }

  // ===========================================================================
  // Render
  // ===========================================================================

  return (
    <div className="transactions-page">
      <header className="transactions-header">
        <div>
          <h1>
            Transactions
          </h1>

          <p>
            View and manage
            all financial
            transactions.
          </p>
        </div>

        <button
          className="primary-btn"
          onClick={
            handleExport
          }
        >
          <Download
            size={18}
          />
          Export
        </button>
      </header>

      <section className="transactions-stats">
        <StatsCard
          title="Transactions"
          value={stats.total}
          icon={CreditCard}
        />

        <StatsCard
          title="Deposits"
          value={formatCurrency(
            stats.deposits
          )}
          icon={
            ArrowDownCircle
          }
        />

        <StatsCard
          title="Withdrawals"
          value={formatCurrency(
            stats.withdrawals
          )}
          icon={
            ArrowUpCircle
          }
        />

        <StatsCard
          title="Completed"
          value={
            stats.completed
          }
          icon={Wallet}
        />
      </section>

      <section className="transactions-filters">
        <div className="search-box">
          <Search size={18} />

          <input
            type="text"
            placeholder="Search transactions..."
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) =>
            setTypeFilter(
              e.target.value
            )
          }
        >
          {TRANSACTION_TYPES.map(
            (type) => (
              <option
                key={type}
                value={type}
              >
                {type}
              </option>
            )
          )}
        </select>

        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(
              e.target.value
            )
          }
        >
          {TRANSACTION_STATUSES.map(
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

      <div className="transactions-table-wrapper">
        <table className="transactions-table">
          <thead>
            <tr>
              <th>
                Reference
              </th>
              <th>
                Member
              </th>
              <th>
                Type
              </th>
              <th>
                Amount
              </th>
              <th>
                Status
              </th>
              <th>
                Channel
              </th>
              <th>
                Date
              </th>
              <th>
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {paginatedTransactions.map(
              (tx) => (
                <tr
                  key={
                    tx._id
                  }
                >
                  <td>
                    {
                      tx.reference
                    }
                  </td>

                  <td>
                    {
                      tx.memberName
                    }
                  </td>

                  <td>
                    <TypeBadge
                      type={
                        tx.type
                      }
                    />
                  </td>

                  <td>
                    {formatCurrency(
                      tx.amount
                    )}
                  </td>

                  <td>
                    <StatusBadge
                      status={
                        tx.status
                      }
                    />
                  </td>

                  <td>
                    {tx.channel ||
                      "-"}
                  </td>

                  <td>
                    {formatDate(
                      tx.createdAt
                    )}
                  </td>

                  <td>
                    <button
                      onClick={() =>
                        navigate(
                          `/transactions/${tx._id}`
                        )
                      }
                    >
                      <Eye
                        size={16}
                      />
                    </button>
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