// frontend/src/pages/Savings.jsx
// ============================================================================
// TITech Community Capital
// Savings Management
// File: src/pages/Savings.jsx
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
  PiggyBank,
  Wallet,
  TrendingUp,
  Plus,
  Eye,
  ArrowDownCircle,
  ArrowUpCircle,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import api from "../services/api";
import { useAuth } from "../context/AuthContext";

import "./Savings.css";

// ============================================================================
// Constants
// ============================================================================

const PAGE_SIZE = 10;
const AUTO_REFRESH_INTERVAL = 60000;

const TRANSACTION_TYPES = [
  "all",
  "deposit",
  "withdrawal",
  "interest",
  "adjustment",
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
// Statistic Card
// ============================================================================

function StatsCard({
  title,
  value,
  icon: Icon,
}) {
  return (
    <div className="savings-stat-card">
      <div className="savings-stat-icon">
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
// Transaction Badge
// ============================================================================

function TransactionBadge({
  type,
}) {
  const normalized =
    (type || "deposit")
      .toLowerCase();

  return (
    <span
      className={`transaction-badge transaction-${normalized}`}
    >
      {type}
    </span>
  );
}

// ============================================================================
// Skeleton
// ============================================================================

function SavingsSkeleton() {
  return (
    <tr>
      <td colSpan={7}>
        <div className="savings-skeleton" />
      </td>
    </tr>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function Savings() {
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

  const [page, setPage] =
    useState(1);

  // ===========================================================================
  // Permissions
  // ===========================================================================

  const canCreate =
    useMemo(() => {
      return [
        "admin",
        "ADMIN",
        "super_admin",
        "cashier",
        "teller",
      ].includes(
        user?.role
      );
    }, [user]);

  // ===========================================================================
  // Fetch Transactions
  // ===========================================================================

  const fetchTransactions =
    useCallback(async () => {
      try {
        setError("");

        const response =
          await api.get(
            "/api/savings"
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
              "Failed to load savings."
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
      mountedRef.current =
        false;

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
            tx?.memberName
              ?.toLowerCase()
              .includes(
                search.toLowerCase()
              ) ||
            tx?.reference
              ?.toLowerCase()
              .includes(
                search.toLowerCase()
              );

          const matchesType =
            typeFilter ===
              "all" ||
            tx?.type ===
              typeFilter;

          return (
            matchesSearch &&
            matchesType
          );
        }
      );
    }, [
      transactions,
      search,
      typeFilter,
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
              t
            ) =>
              sum +
              Number(
                t.amount ||
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
              t
            ) =>
              sum +
              Number(
                t.amount ||
                  0
              ),
            0
          );

      return {
        count:
          transactions.length,
        deposits,
        withdrawals,
        balance:
          deposits -
          withdrawals,
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
  // Loading
  // ===========================================================================

  if (loading) {
    return (
      <div className="savings-page">
        <table className="savings-table">
          <tbody>
            <SavingsSkeleton />
            <SavingsSkeleton />
            <SavingsSkeleton />
          </tbody>
        </table>
      </div>
    );
  }

  // ===========================================================================
  // Render
  // ===========================================================================

  return (
    <div className="savings-page">
      <header className="savings-header">
        <div>
          <h1>
            Savings Portfolio
          </h1>

          <p>
            Manage deposits,
            withdrawals and
            savings accounts.
          </p>
        </div>

        {canCreate && (
          <button
            className="primary-btn"
            onClick={() =>
              navigate(
                "/savings/new"
              )
            }
          >
            <Plus size={18} />
            New Transaction
          </button>
        )}
      </header>

      <section className="savings-stats">
        <StatsCard
          title="Transactions"
          value={stats.count}
          icon={Wallet}
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
          title="Net Savings"
          value={formatCurrency(
            stats.balance
          )}
          icon={
            TrendingUp
          }
        />

        <StatsCard
          title="Portfolio"
          value={formatCurrency(
            stats.balance
          )}
          icon={
            PiggyBank
          }
        />
      </section>

      <section className="savings-filters">
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
      </section>

      {error && (
        <div className="error-box">
          <AlertCircle />

          <p>{error}</p>

          <button
            onClick={handleRetry}
          >
            <RefreshCw
              size={16}
            />
            Retry
          </button>
        </div>
      )}

      <div className="savings-table-wrapper">
        <table className="savings-table">
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
                Date
              </th>
              <th>
                Channel
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
                    <TransactionBadge
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
                    {formatDate(
                      tx.createdAt
                    )}
                  </td>

                  <td>
                    {tx.channel ||
                      "-"}
                  </td>

                  <td>
                    <button
                      onClick={() =>
                        navigate(
                          `/savings/${tx._id}`
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