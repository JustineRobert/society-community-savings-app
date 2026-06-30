// frontend/src/pages/Members.jsx
// ============================================================================
// TITech Community Capital
// Members Management
// File: src/pages/Members.jsx
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
  Users,
  UserPlus,
  Eye,
  Edit,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import api from "../services/api";
import { useAuth } from "../context/AuthContext";

import "./Members.css";

// ============================================================================
// Constants
// ============================================================================

const PAGE_SIZE = 10;
const AUTO_REFRESH_INTERVAL = 60000;

// ============================================================================
// Skeleton
// ============================================================================

function MemberSkeleton() {
  return (
    <tr>
      <td colSpan={7}>
        <div className="member-skeleton" />
      </td>
    </tr>
  );
}

// ============================================================================
// Status Badge
// ============================================================================

function StatusBadge({ status }) {
  const normalized =
    (status || "active").toLowerCase();

  return (
    <span
      className={`member-status member-status-${normalized}`}
    >
      {status || "Active"}
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
    <div className="member-stat-card">
      <div className="member-stat-icon">
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
// Main Component
// ============================================================================

export default function Members() {
  const navigate = useNavigate();

  const { user } = useAuth();

  const mountedRef = useRef(false);
  const refreshRef = useRef();

  const [loading, setLoading] =
    useState(true);

  const [members, setMembers] =
    useState([]);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [page, setPage] =
    useState(1);

  // ===========================================================================
  // Role
  // ===========================================================================

  const isAdmin = useMemo(() => {
    return [
      "admin",
      "ADMIN",
      "super_admin",
    ].includes(user?.role);
  }, [user]);

  // ===========================================================================
  // Fetch Members
  // ===========================================================================

  const fetchMembers =
    useCallback(async () => {
      try {
        setError("");

        const response =
          await api.get(
            "/api/members"
          );

        const data =
          response?.data ||
          response ||
          [];

        if (mountedRef.current) {
          setMembers(
            Array.isArray(data)
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
              "Failed to load members."
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

    fetchMembers();

    refreshRef.current =
      setInterval(
        fetchMembers,
        AUTO_REFRESH_INTERVAL
      );

    return () => {
      mountedRef.current = false;

      clearInterval(
        refreshRef.current
      );
    };
  }, [fetchMembers]);

  // ===========================================================================
  // Filtered Members
  // ===========================================================================

  const filteredMembers =
    useMemo(() => {
      return members.filter(
        (member) => {
          const matchesSearch =
            !search ||
            member?.name
              ?.toLowerCase()
              .includes(
                search.toLowerCase()
              ) ||
            member?.email
              ?.toLowerCase()
              .includes(
                search.toLowerCase()
              ) ||
            member?.phone
              ?.includes(search);

          const matchesStatus =
            statusFilter === "all" ||
            member?.status ===
              statusFilter;

          return (
            matchesSearch &&
            matchesStatus
          );
        }
      );
    }, [
      members,
      search,
      statusFilter,
    ]);

  // ===========================================================================
  // Pagination
  // ===========================================================================

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredMembers.length /
        PAGE_SIZE
    )
  );

  const paginatedMembers =
    useMemo(() => {
      const start =
        (page - 1) * PAGE_SIZE;

      return filteredMembers.slice(
        start,
        start + PAGE_SIZE
      );
    }, [
      filteredMembers,
      page,
    ]);

  // ===========================================================================
  // Statistics
  // ===========================================================================

  const stats = useMemo(() => {
    const active =
      members.filter(
        (m) =>
          m.status === "active"
      ).length;

    const suspended =
      members.filter(
        (m) =>
          m.status ===
          "suspended"
      ).length;

    return {
      total: members.length,
      active,
      suspended,
    };
  }, [members]);

  // ===========================================================================
  // Retry
  // ===========================================================================

  const handleRetry =
    useCallback(() => {
      setLoading(true);
      fetchMembers();
    }, [fetchMembers]);

  // ===========================================================================
  // Loading
  // ===========================================================================

  if (loading) {
    return (
      <div className="members-page">
        <table className="members-table">
          <tbody>
            <MemberSkeleton />
            <MemberSkeleton />
            <MemberSkeleton />
            <MemberSkeleton />
          </tbody>
        </table>
      </div>
    );
  }

  // ===========================================================================
  // Render
  // ===========================================================================

  return (
    <div className="members-page">
      <header className="members-header">
        <div>
          <h1>Members</h1>
          <p>
            Manage community members.
          </p>
        </div>

        {isAdmin && (
          <button
            className="primary-btn"
            onClick={() =>
              navigate(
                "/members/new"
              )
            }
          >
            <UserPlus size={18} />
            Add Member
          </button>
        )}
      </header>

      <section className="members-stats">
        <StatsCard
          title="Total Members"
          value={stats.total}
          icon={Users}
        />

        <StatsCard
          title="Active"
          value={stats.active}
          icon={Users}
        />

        <StatsCard
          title="Suspended"
          value={stats.suspended}
          icon={Users}
        />
      </section>

      <section className="members-filters">
        <div className="search-box">
          <Search size={18} />

          <input
            type="text"
            placeholder="Search members..."
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(
              e.target.value
            )
          }
        >
          <option value="all">
            All Statuses
          </option>

          <option value="active">
            Active
          </option>

          <option value="suspended">
            Suspended
          </option>

          <option value="pending">
            Pending
          </option>
        </select>
      </section>

      {error && (
        <div className="error-box">
          <AlertCircle />

          <p>{error}</p>

          <button
            onClick={handleRetry}
          >
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      )}

      <div className="members-table-wrapper">
        <table className="members-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Member No.</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {paginatedMembers.map(
              (member) => (
                <tr
                  key={
                    member._id
                  }
                >
                  <td>
                    {member.name}
                  </td>

                  <td>
                    {member.memberNumber ||
                      "-"}
                  </td>

                  <td>
                    {member.email}
                  </td>

                  <td>
                    {member.phone}
                  </td>

                  <td>
                    <StatusBadge
                      status={
                        member.status
                      }
                    />
                  </td>

                  <td>
                    {member.createdAt
                      ? new Date(
                          member.createdAt
                        ).toLocaleDateString()
                      : "-"}
                  </td>

                  <td>
                    <div className="action-buttons">
                      <button
                        onClick={() =>
                          navigate(
                            `/members/${member._id}`
                          )
                        }
                      >
                        <Eye
                          size={16}
                        />
                      </button>

                      {isAdmin && (
                        <button
                          onClick={() =>
                            navigate(
                              `/members/${member._id}/edit`
                            )
                          }
                        >
                          <Edit
                            size={16}
                          />
                        </button>
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
          disabled={page === 1}
          onClick={() =>
            setPage(
              (p) => p - 1
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
            page === totalPages
          }
          onClick={() =>
            setPage(
              (p) => p + 1
            )
          }
        >
          Next
        </button>
      </footer>
    </div>
  );
}