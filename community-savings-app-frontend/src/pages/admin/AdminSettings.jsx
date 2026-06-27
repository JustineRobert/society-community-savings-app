// ============================================================================
// frontend/src/pages/admin/AdminSettings.jsx
// TITech Community Capital
// Enterprise Administration Settings Center
// Production Grade
// ============================================================================

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';

import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';

import {
  Save,
  Shield,
  Settings,
  Bell,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Lock,
  Database,
} from 'lucide-react';

import { updateSettings } from '../../redux/actions/settingsActions';

const DEFAULT_SETTINGS = {
  siteName: 'TITech Community Capital',

  enableContributions: true,
  enableLoans: true,
  enableSavings: true,

  enableKYC: true,
  enableAML: true,
  enableFraudDetection: true,
  enableRiskScoring: true,

  enableEmailNotifications: true,
  enableSMSNotifications: false,
  enablePushNotifications: true,

  maintenanceMode: false,

  defaultUserRole: 'member',
  maxLoanAmount: 10000000,
  maxGroupMembers: 500,
};

const AdminSettings = () => {
  const dispatch = useDispatch();

  const settingsState = useSelector(
    (state) => state.settings || {}
  );

  const {
    data: settings,
    loading,
    error,
    lastUpdated,
  } = settingsState;

  const [localSettings, setLocalSettings] =
    useState(DEFAULT_SETTINGS);

  const [saving, setSaving] = useState(false);

  // ===========================================================================
  // LOAD SETTINGS
  // ===========================================================================

  useEffect(() => {
    if (!settings) return;

    setLocalSettings({
      ...DEFAULT_SETTINGS,
      ...settings,
    });
  }, [settings]);

  // ===========================================================================
  // CHANGE HANDLERS
  // ===========================================================================

  const handleInputChange = useCallback((e) => {
    const {
      name,
      value,
      type,
      checked,
    } = e.target;

    setLocalSettings((prev) => ({
      ...prev,
      [name]:
        type === 'checkbox'
          ? checked
          : type === 'number'
          ? Number(value)
          : value,
    }));
  }, []);

  // ===========================================================================
  // VALIDATION
  // ===========================================================================

  const validationErrors = useMemo(() => {
    const errors = [];

    if (!localSettings.siteName?.trim()) {
      errors.push('Site Name is required');
    }

    if (localSettings.maxLoanAmount <= 0) {
      errors.push(
        'Maximum Loan Amount must be greater than zero'
      );
    }

    if (localSettings.maxGroupMembers < 2) {
      errors.push(
        'Group member limit must be at least 2'
      );
    }

    return errors;
  }, [localSettings]);

  // ===========================================================================
  // SAVE
  // ===========================================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (validationErrors.length > 0) {
      validationErrors.forEach((err) =>
        toast.error(err)
      );
      return;
    }

    try {
      setSaving(true);

      await dispatch(
        updateSettings(localSettings)
      );

      toast.success(
        'Platform settings updated successfully'
      );
    } catch (err) {
      console.error(err);

      toast.error(
        err?.message ||
          'Failed to update settings'
      );
    } finally {
      setSaving(false);
    }
  };

  // ===========================================================================
  // LOADING
  // ===========================================================================

  if (loading && !settings) {
    return (
      <div className="admin-settings-page">
        <div className="settings-loading">
          <RefreshCw
            size={42}
            className="animate-spin"
          />
          <h3>Loading Settings...</h3>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <div className="admin-settings-page">
      <div className="settings-header">
        <div>
          <h1>
            <Settings size={28} />
            Platform Settings
          </h1>

          <p>
            Configure TITech Community Capital
            platform behavior.
          </p>
        </div>

        <div className="settings-status">
          <CheckCircle size={18} />
          <span>
            Last Updated:{' '}
            {lastUpdated
              ? new Date(
                  lastUpdated
                ).toLocaleString()
              : 'Not Available'}
          </span>
        </div>
      </div>

      {error && (
        <div className="settings-error">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="settings-form"
      >
        {/* ===================================================== */}
        {/* GENERAL */}
        {/* ===================================================== */}

        <section className="settings-card">
          <h2>
            <Database size={20} />
            General Configuration
          </h2>

          <div className="form-group">
            <label>Platform Name</label>

            <input
              type="text"
              name="siteName"
              value={localSettings.siteName}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Default User Role</label>

            <select
              name="defaultUserRole"
              value={
                localSettings.defaultUserRole
              }
              onChange={handleInputChange}
            >
              <option value="member">
                Member
              </option>

              <option value="manager">
                Manager
              </option>

              <option value="admin">
                Admin
              </option>
            </select>
          </div>
        </section>

        {/* ===================================================== */}
        {/* FINTECH FEATURES */}
        {/* ===================================================== */}

        <section className="settings-card">
          <h2>
            <Shield size={20} />
            Financial Services
          </h2>

          <Toggle
            label="Enable Contributions"
            name="enableContributions"
            value={
              localSettings.enableContributions
            }
            onChange={handleInputChange}
          />

          <Toggle
            label="Enable Savings"
            name="enableSavings"
            value={localSettings.enableSavings}
            onChange={handleInputChange}
          />

          <Toggle
            label="Enable Loans"
            name="enableLoans"
            value={localSettings.enableLoans}
            onChange={handleInputChange}
          />

          <div className="form-group">
            <label>
              Maximum Loan Amount (UGX)
            </label>

            <input
              type="number"
              name="maxLoanAmount"
              value={
                localSettings.maxLoanAmount
              }
              onChange={handleInputChange}
            />
          </div>

          <div className="form-group">
            <label>
              Maximum Group Members
            </label>

            <input
              type="number"
              name="maxGroupMembers"
              value={
                localSettings.maxGroupMembers
              }
              onChange={handleInputChange}
            />
          </div>
        </section>

        {/* ===================================================== */}
        {/* COMPLIANCE */}
        {/* ===================================================== */}

        <section className="settings-card">
          <h2>
            <Lock size={20} />
            Compliance & Risk
          </h2>

          <Toggle
            label="Enable KYC"
            name="enableKYC"
            value={localSettings.enableKYC}
            onChange={handleInputChange}
          />

          <Toggle
            label="Enable AML Monitoring"
            name="enableAML"
            value={localSettings.enableAML}
            onChange={handleInputChange}
          />

          <Toggle
            label="Enable Fraud Detection"
            name="enableFraudDetection"
            value={
              localSettings.enableFraudDetection
            }
            onChange={handleInputChange}
          />

          <Toggle
            label="Enable Risk Scoring"
            name="enableRiskScoring"
            value={
              localSettings.enableRiskScoring
            }
            onChange={handleInputChange}
          />
        </section>

        {/* ===================================================== */}
        {/* NOTIFICATIONS */}
        {/* ===================================================== */}

        <section className="settings-card">
          <h2>
            <Bell size={20} />
            Notifications
          </h2>

          <Toggle
            label="Email Notifications"
            name="enableEmailNotifications"
            value={
              localSettings.enableEmailNotifications
            }
            onChange={handleInputChange}
          />

          <Toggle
            label="SMS Notifications"
            name="enableSMSNotifications"
            value={
              localSettings.enableSMSNotifications
            }
            onChange={handleInputChange}
          />

          <Toggle
            label="Push Notifications"
            name="enablePushNotifications"
            value={
              localSettings.enablePushNotifications
            }
            onChange={handleInputChange}
          />
        </section>

        {/* ===================================================== */}
        {/* MAINTENANCE */}
        {/* ===================================================== */}

        <section className="settings-card danger-card">
          <h2>
            <AlertTriangle size={20} />
            Maintenance Mode
          </h2>

          <Toggle
            label="Enable Maintenance Mode"
            name="maintenanceMode"
            value={
              localSettings.maintenanceMode
            }
            onChange={handleInputChange}
          />
        </section>

        {/* ===================================================== */}
        {/* SAVE */}
        {/* ===================================================== */}

        <div className="settings-actions">
          <button
            type="submit"
            disabled={
              saving ||
              validationErrors.length > 0
            }
            className="save-btn"
          >
            {saving ? (
              <>
                <RefreshCw
                  size={18}
                  className="animate-spin"
                />
                Saving...
              </>
            ) : (
              <>
                <Save size={18} />
                Save Settings
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

// ============================================================================
// TOGGLE COMPONENT
// ============================================================================

const Toggle = ({
  label,
  name,
  value,
  onChange,
}) => {
  return (
    <div className="toggle-row">
      <label htmlFor={name}>
        {label}
      </label>

      <input
        id={name}
        type="checkbox"
        name={name}
        checked={value}
        onChange={onChange}
      />
    </div>
  );
};

export default AdminSettings;