// ============================================================================
// TITech Community Capital
// Enterprise Route Configuration
// File: src/routes/routeConfig.js
// Production Grade
// ============================================================================

import React, {
  lazy,
} from "react";

import {
  LayoutDashboard,
  Users,
  Wallet,
  CreditCard,
  Receipt,
  FileText,
  Settings,
  Building2,
  Shield,
  Bell,
  BarChart3,
} from "lucide-react";

// ============================================================================
// Lazy Components
// ============================================================================

export const Dashboard = lazy(() =>
  import("../pages/Dashboard")
);

export const Members = lazy(() =>
  import("../pages/Members")
);

export const Savings = lazy(() =>
  import("../pages/Savings")
);

export const Loans = lazy(() =>
  import("../pages/Loans")
);

export const Transactions = lazy(() =>
  import("../pages/Transactions")
);

export const Reports = lazy(() =>
  import("../pages/Reports")
);

export const SettingsPage = lazy(() =>
  import("../pages/Settings")
);

// ============================================================================
// Roles
// ============================================================================

export const ROLES = {
  MEMBER: "member",
  STAFF: "staff",
  MANAGER: "manager",
  ADMIN: "admin",
  SUPER_ADMIN:
    "super_admin",
};

// ============================================================================
// Permissions
// ============================================================================

export const PERMISSIONS = {
  DASHBOARD_VIEW:
    "dashboard.view",

  MEMBER_VIEW:
    "member.view",

  MEMBER_CREATE:
    "member.create",

  MEMBER_UPDATE:
    "member.update",

  MEMBER_DELETE:
    "member.delete",

  SAVINGS_VIEW:
    "savings.view",

  SAVINGS_CREATE:
    "savings.create",

  LOAN_VIEW:
    "loan.view",

  LOAN_APPROVE:
    "loan.approve",

  LOAN_DISBURSE:
    "loan.disburse",

  TRANSACTION_VIEW:
    "transaction.view",

  REPORT_VIEW:
    "report.view",

  REPORT_EXPORT:
    "report.export",

  SETTINGS_VIEW:
    "settings.view",

  SETTINGS_MANAGE:
    "settings.manage",

  USERS_MANAGE:
    "users.manage",

  ROLES_MANAGE:
    "roles.manage",

  AUDIT_VIEW:
    "audit.view",
};

// ============================================================================
// Features
// ============================================================================

export const FEATURES = {
  ADVANCED_REPORTING:
    "advanced_reporting",

  TREASURY:
    "treasury",

  BILLING:
    "billing",

  AI_ASSISTANT:
    "ai_assistant",

  MULTI_BRANCH:
    "multi_branch",

  AML:
    "aml",

  KYC:
    "kyc",

  FRAUD:
    "fraud_detection",

  EXECUTIVE_DASHBOARD:
    "executive_dashboard",
};

// ============================================================================
// Subscription Plans
// ============================================================================

export const PLANS = {
  FREE: "free",
  STARTER: "starter",
  PROFESSIONAL:
    "professional",
  ENTERPRISE:
    "enterprise",
};

// ============================================================================
// Route Configuration
// ============================================================================

export const routeConfig = [
  {
    id: "dashboard",
    path: "/dashboard",
    name: "Dashboard",
    title:
      "Community Dashboard",
    icon:
      LayoutDashboard,
    component:
      Dashboard,
    protected: true,
    showInSidebar: true,
    showInMenu: true,
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
    ],
    roles: [],
    feature: null,
    tenant: true,
    plan: [],
    analytics: true,
    breadcrumb: true,
  },

  {
    id: "members",
    path: "/members",
    name: "Members",
    title:
      "Member Management",
    icon: Users,
    component:
      Members,
    protected: true,
    showInSidebar: true,
    showInMenu: true,
    permissions: [
      PERMISSIONS.MEMBER_VIEW,
    ],
    tenant: true,
    analytics: true,
    breadcrumb: true,
  },

  {
    id: "savings",
    path: "/savings",
    name: "Savings",
    title:
      "Savings Management",
    icon: Wallet,
    component:
      Savings,
    protected: true,
    showInSidebar: true,
    showInMenu: true,
    permissions: [
      PERMISSIONS.SAVINGS_VIEW,
    ],
    tenant: true,
    analytics: true,
    breadcrumb: true,
  },

  {
    id: "loans",
    path: "/loans",
    name: "Loans",
    title:
      "Loan Management",
    icon:
      CreditCard,
    component: Loans,
    protected: true,
    showInSidebar: true,
    showInMenu: true,
    permissions: [
      PERMISSIONS.LOAN_VIEW,
    ],
    tenant: true,
    analytics: true,
    breadcrumb: true,
  },

  {
    id: "transactions",
    path: "/transactions",
    name: "Transactions",
    title:
      "Transactions",
    icon: Receipt,
    component:
      Transactions,
    protected: true,
    showInSidebar: true,
    showInMenu: true,
    permissions: [
      PERMISSIONS.TRANSACTION_VIEW,
    ],
    tenant: true,
    analytics: true,
    breadcrumb: true,
  },

  {
    id: "reports",
    path: "/reports",
    name: "Reports",
    title: "Reports",
    icon: FileText,
    component:
      Reports,
    protected: true,
    showInSidebar: true,
    showInMenu: true,
    permissions: [
      PERMISSIONS.REPORT_VIEW,
    ],
    feature:
      FEATURES.ADVANCED_REPORTING,
    tenant: true,
    plan: [
      PLANS.PROFESSIONAL,
      PLANS.ENTERPRISE,
    ],
    analytics: true,
    breadcrumb: true,
  },

  {
    id: "settings",
    path: "/settings",
    name: "Settings",
    title:
      "System Settings",
    icon: Settings,
    component:
      SettingsPage,
    protected: true,
    showInSidebar: true,
    showInMenu: false,
    permissions: [
      PERMISSIONS.SETTINGS_MANAGE,
    ],
    roles: [
      ROLES.ADMIN,
      ROLES.SUPER_ADMIN,
    ],
    tenant: true,
    analytics: true,
    breadcrumb: true,
  },

  {
    id: "branches",
    path: "/branches",
    name: "Branches",
    title:
      "Branch Management",
    icon:
      Building2,
    component: null,
    protected: true,
    showInSidebar: false,
    permissions: [],
    feature:
      FEATURES.MULTI_BRANCH,
    tenant: true,
  },

  {
    id: "audit",
    path: "/audit",
    name: "Audit Logs",
    title:
      "Audit Logs",
    icon: Shield,
    component: null,
    protected: true,
    permissions: [
      PERMISSIONS.AUDIT_VIEW,
    ],
    roles: [
      ROLES.ADMIN,
      ROLES.SUPER_ADMIN,
    ],
    tenant: true,
  },

  {
    id: "notifications",
    path: "/notifications",
    name:
      "Notifications",
    title:
      "Notifications",
    icon: Bell,
    component: null,
    protected: true,
    tenant: true,
  },

  {
    id: "executive",
    path:
      "/executive-dashboard",
    name:
      "Executive Dashboard",
    title:
      "Executive Dashboard",
    icon: BarChart3,
    component: null,
    protected: true,
    feature:
      FEATURES.EXECUTIVE_DASHBOARD,
    roles: [
      ROLES.ADMIN,
      ROLES.SUPER_ADMIN,
    ],
    plan: [
      PLANS.ENTERPRISE,
    ],
    tenant: true,
  },
];

// ============================================================================
// Helpers
// ============================================================================

export function getRouteByPath(
  path
) {
  return routeConfig.find(
    (route) =>
      route.path === path
  );
}

export function getRouteById(
  id
) {
  return routeConfig.find(
    (route) =>
      route.id === id
  );
}

export function getSidebarRoutes() {
  return routeConfig.filter(
    (route) =>
      route.showInSidebar
  );
}

export function getMenuRoutes() {
  return routeConfig.filter(
    (route) =>
      route.showInMenu
  );
}

export function getBreadcrumbRoutes() {
  return routeConfig.filter(
    (route) =>
      route.breadcrumb
  );
}

export function getAnalyticsRoutes() {
  return routeConfig.filter(
    (route) =>
      route.analytics
  );
}

export function getProtectedRoutes() {
  return routeConfig.filter(
    (route) =>
      route.protected
  );
}

// ============================================================================
// Default Export
// ============================================================================

export default routeConfig;