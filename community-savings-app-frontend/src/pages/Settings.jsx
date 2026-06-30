// ============================================================================
// TITech Community Capital
// Enterprise Settings Page
// File: frontend/src/pages/Settings.jsx
// Production Grade
// ============================================================================

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Bell,
  Building2,
  Key,
  Lock,
  Moon,
  Save,
  Shield,
  Sun,
  User,
} from "lucide-react";

import { toast } from "react-toastify";

import api from "../services/api";
import { useAuth } from "../context/AuthContext";

import "./Settings.css";

const DEFAULT_SETTINGS = {
  profile: {
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
  },

  security: {
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    twoFactorEnabled: false,
  },

  notifications: {
    email: true,
    sms: true,
    push: true,
    marketing: false,
  },

  preferences: {
    theme: "light",
    language: "en",
    timezone: "Africa/Kampala",
  },

  tenant: {
    name: "",
    plan: "",
    features: [],
  },
};

function Settings() {
  const { user } = useAuth();

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [settings, setSettings] =
    useState(DEFAULT_SETTINGS);

  const [activeTab, setActiveTab] =
    useState("profile");

  const isAdmin = useMemo(() => {
    return [
      "admin",
      "super_admin",
      "ADMIN",
    ].includes(user?.role);
  }, [user]);

  // ===========================================================================
  // Load Settings
  // ===========================================================================

  const loadSettings =
    useCallback(async () => {
      try {
        setLoading(true);

        const [
          profileRes,
          tenantRes,
        ] = await Promise.all([
          api.get("/api/users/me"),
          isAdmin
            ? api.get(
                "/api/tenant/settings"
              )
            : Promise.resolve({
                data: {},
              }),
        ]);

        const profile =
          profileRes.data || {};

        const tenant =
          tenantRes.data || {};

        setSettings({
          profile: {
            firstName:
              profile.firstName ||
              "",
            lastName:
              profile.lastName ||
              "",
            email:
              profile.email ||
              "",
            phoneNumber:
              profile.phoneNumber ||
              "",
          },

          security:
            DEFAULT_SETTINGS.security,

          notifications:
            profile.notifications ||
            DEFAULT_SETTINGS.notifications,

          preferences:
            profile.preferences ||
            DEFAULT_SETTINGS.preferences,

          tenant: {
            name:
              tenant.name || "",
            plan:
              tenant.plan || "",
            features:
              tenant.features ||
              [],
          },
        });
      } catch (error) {
        toast.error(
          "Failed to load settings."
        );
      } finally {
        setLoading(false);
      }
    }, [isAdmin]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // ===========================================================================
  // Handlers
  // ===========================================================================

  const updateSection =
    useCallback(
      (
        section,
        field,
        value
      ) => {
        setSettings(
          (previous) => ({
            ...previous,
            [section]: {
              ...previous[
                section
              ],
              [field]:
                value,
            },
          })
        );
      },
      []
    );

  const saveProfile =
    async () => {
      try {
        setSaving(true);

        await api.put(
          "/api/users/me",
          {
            ...settings.profile,
            notifications:
              settings.notifications,
            preferences:
              settings.preferences,
          }
        );

        toast.success(
          "Settings updated successfully."
        );
      } catch (error) {
        toast.error(
          error.response?.data
            ?.message ||
            "Failed to save settings."
        );
      } finally {
        setSaving(false);
      }
    };

  const changePassword =
    async () => {
      const {
        currentPassword,
        newPassword,
        confirmPassword,
      } = settings.security;

      if (
        !currentPassword ||
        !newPassword
      ) {
        return toast.error(
          "All password fields are required."
        );
      }

      if (
        newPassword !==
        confirmPassword
      ) {
        return toast.error(
          "Passwords do not match."
        );
      }

      try {
        setSaving(true);

        await api.post(
          "/api/auth/change-password",
          {
            currentPassword,
            newPassword,
          }
        );

        toast.success(
          "Password updated."
        );

        setSettings(
          (previous) => ({
            ...previous,
            security:
              DEFAULT_SETTINGS.security,
          })
        );
      } catch (error) {
        toast.error(
          error.response?.data
            ?.message ||
            "Failed to change password."
        );
      } finally {
        setSaving(false);
      }
    };

  // ===========================================================================
  // Loading
  // ===========================================================================

  if (loading) {
    return (
      <div className="settings-page">
        <div className="settings-loading">
          Loading settings...
        </div>
      </div>
    );
  }

  // ===========================================================================
  // Render
  // ===========================================================================

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>Settings</h1>

        <button
          className="save-btn"
          onClick={saveProfile}
          disabled={saving}
        >
          <Save size={18} />
          {saving
            ? "Saving..."
            : "Save Changes"}
        </button>
      </div>

      <div className="settings-layout">
        <aside className="settings-sidebar">
          <button
            onClick={() =>
              setActiveTab(
                "profile"
              )
            }
            className={
              activeTab ===
              "profile"
                ? "active"
                : ""
            }
          >
            <User size={18} />
            Profile
          </button>

          <button
            onClick={() =>
              setActiveTab(
                "security"
              )
            }
            className={
              activeTab ===
              "security"
                ? "active"
                : ""
            }
          >
            <Lock size={18} />
            Security
          </button>

          <button
            onClick={() =>
              setActiveTab(
                "notifications"
              )
            }
            className={
              activeTab ===
              "notifications"
                ? "active"
                : ""
            }
          >
            <Bell size={18} />
            Notifications
          </button>

          <button
            onClick={() =>
              setActiveTab(
                "preferences"
              )
            }
            className={
              activeTab ===
              "preferences"
                ? "active"
                : ""
            }
          >
            <Moon size={18} />
            Preferences
          </button>

          {isAdmin && (
            <button
              onClick={() =>
                setActiveTab(
                  "tenant"
                )
              }
              className={
                activeTab ===
                "tenant"
                  ? "active"
                  : ""
              }
            >
              <Building2
                size={18}
              />
              Tenant
            </button>
          )}
        </aside>

        <section className="settings-content">
          {activeTab ===
            "profile" && (
            <>
              <h2>
                Profile
              </h2>

              <input
                value={
                  settings.profile
                    .firstName
                }
                placeholder="First Name"
                onChange={(e) =>
                  updateSection(
                    "profile",
                    "firstName",
                    e.target
                      .value
                  )
                }
              />

              <input
                value={
                  settings.profile
                    .lastName
                }
                placeholder="Last Name"
                onChange={(e) =>
                  updateSection(
                    "profile",
                    "lastName",
                    e.target
                      .value
                  )
                }
              />

              <input
                value={
                  settings.profile
                    .email
                }
                placeholder="Email"
                onChange={(e) =>
                  updateSection(
                    "profile",
                    "email",
                    e.target
                      .value
                  )
                }
              />

              <input
                value={
                  settings.profile
                    .phoneNumber
                }
                placeholder="Phone Number"
                onChange={(e) =>
                  updateSection(
                    "profile",
                    "phoneNumber",
                    e.target
                      .value
                  )
                }
              />
            </>
          )}

          {activeTab ===
            "security" && (
            <>
              <h2>
                Security
              </h2>

              <input
                type="password"
                placeholder="Current Password"
                value={
                  settings.security
                    .currentPassword
                }
                onChange={(e) =>
                  updateSection(
                    "security",
                    "currentPassword",
                    e.target
                      .value
                  )
                }
              />

              <input
                type="password"
                placeholder="New Password"
                value={
                  settings.security
                    .newPassword
                }
                onChange={(e) =>
                  updateSection(
                    "security",
                    "newPassword",
                    e.target
                      .value
                  )
                }
              />

              <input
                type="password"
                placeholder="Confirm Password"
                value={
                  settings.security
                    .confirmPassword
                }
                onChange={(e) =>
                  updateSection(
                    "security",
                    "confirmPassword",
                    e.target
                      .value
                  )
                }
              />

              <button
                onClick={
                  changePassword
                }
              >
                <Key size={18} />
                Change Password
              </button>
            </>
          )}

          {activeTab ===
            "notifications" && (
            <>
              <h2>
                Notifications
              </h2>

              {Object.entries(
                settings.notifications
              ).map(
                (
                  [
                    key,
                    value,
                  ]
                ) => (
                  <label
                    key={key}
                  >
                    <input
                      type="checkbox"
                      checked={
                        value
                      }
                      onChange={(
                        e
                      ) =>
                        updateSection(
                          "notifications",
                          key,
                          e.target
                            .checked
                        )
                      }
                    />

                    {key}
                  </label>
                )
              )}
            </>
          )}

          {activeTab ===
            "preferences" && (
            <>
              <h2>
                Preferences
              </h2>

              <label>
                Theme
              </label>

              <select
                value={
                  settings
                    .preferences
                    .theme
                }
                onChange={(e) =>
                  updateSection(
                    "preferences",
                    "theme",
                    e.target
                      .value
                  )
                }
              >
                <option value="light">
                  Light
                </option>

                <option value="dark">
                  Dark
                </option>
              </select>
            </>
          )}

          {activeTab ===
            "tenant" &&
            isAdmin && (
              <>
                <h2>
                  Tenant
                </h2>

                <p>
                  <strong>
                    Name:
                  </strong>{" "}
                  {
                    settings
                      .tenant
                      .name
                  }
                </p>

                <p>
                  <strong>
                    Plan:
                  </strong>{" "}
                  {
                    settings
                      .tenant
                      .plan
                  }
                </p>

                <h3>
                  Enabled
                  Features
                </h3>

                <ul>
                  {settings.tenant.features.map(
                    (
                      feature
                    ) => (
                      <li
                        key={
                          feature
                        }
                      >
                        <Shield
                          size={
                            14
                          }
                        />
                        {
                          feature
                        }
                      </li>
                    )
                  )}
                </ul>
              </>
            )}
        </section>
      </div>
    </div>
  );
}

export default Settings;