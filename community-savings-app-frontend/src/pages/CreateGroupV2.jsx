// src/pages/CreateGroupV2.jsx - Enhanced Group Creation with Roles, CSV, Preview, and Progress
import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast } from 'react-toastify';
import { AlertCircle, CheckCircle, Upload, Users, Eye, Send, Trash2 } from 'lucide-react';
import './CreateGroupV2.css';

const GROUP_TYPES = [
  { value: 'savings', label: 'Savings Group', description: 'Traditional community savings pool' },
  {
    value: 'investment',
    label: 'Investment Group',
    description: 'Focus on investment opportunities',
  },
  {
    value: 'community',
    label: 'Community Support',
    description: 'General community support and welfare',
  },
  { value: 'welfare', label: 'Welfare Group', description: 'Member welfare and mutual support' },
];

const MEMBER_ROLES = [
  { value: 'member', label: 'Member', description: 'Regular group member' },
  { value: 'treasurer', label: 'Treasurer', description: 'Financial management' },
  { value: 'secretary', label: 'Secretary', description: 'Record keeping' },
];

const CreateGroupV2 = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // RBAC Check - Only admins can create groups
  useMemo(() => {
    if (user && user.role !== 'admin') {
      toast.error('Only administrators can create groups');
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Step management
  const [step, setStep] = useState(1); // 1: Basic Info, 2: Members, 3: Preview, 4: Confirmation
  const [groupName, setGroupName] = useState('');
  const [groupType, setGroupType] = useState('savings');
  const [description, setDescription] = useState('');

  // Members management with roles
  const [memberEmails, setMemberEmails] = useState(['']);
  const [memberRoles, setMemberRoles] = useState(['member']);
  const [csvFile, setCsvFile] = useState(null);
  const [csvErrors, setCsvErrors] = useState([]);

  // UI states
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    message: '',
    failures: [],
    successCount: 0,
  });

  // Email validation
  const validateEmail = useCallback((email) => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email.trim());
  }, []);

  // CSV parser with comprehensive validation
  const parseCSV = useCallback(
    (file) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const text = e.target.result;
            const lines = text.split('\n').filter((line) => line.trim());
            const parsedMembers = [];
            const errors = [];

            if (lines.length === 0) {
              reject(['CSV file is empty']);
              return;
            }

            lines.forEach((line, index) => {
              const parts = line.split(',').map((p) => p.trim());
              const email = parts[0];
              const role = parts[1]?.toLowerCase() || 'member';

              if (!email) {
                errors.push(`Row ${index + 1}: Empty email address`);
                return;
              }

              if (!validateEmail(email)) {
                errors.push(`Row ${index + 1}: Invalid email "${email}"`);
                return;
              }

              if (!MEMBER_ROLES.find((r) => r.value === role)) {
                const validRoles = MEMBER_ROLES.map((r) => r.value).join(', ');
                errors.push(`Row ${index + 1}: Invalid role "${role}". Valid roles: ${validRoles}`);
                return;
              }

              parsedMembers.push({ email, role });
            });

            if (errors.length > 0) {
              reject(errors);
            } else if (parsedMembers.length === 0) {
              reject(['No valid entries found in CSV']);
            } else {
              resolve(parsedMembers);
            }
          } catch (err) {
            reject(['Failed to parse CSV file: ' + err.message]);
          }
        };
        reader.onerror = () => reject(['Failed to read CSV file']);
        reader.readAsText(file);
      });
    },
    [validateEmail]
  );

  // CSV upload handler
  const handleCsvUpload = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const members = await parseCSV(file);
        setMemberEmails(members.map((m) => m.email));
        setMemberRoles(members.map((m) => m.role));
        setCsvFile(file.name);
        setCsvErrors([]);
        toast.success(`✅ Loaded ${members.length} members from CSV`);
        setError('');
      } catch (errors) {
        setCsvErrors(errors);
        toast.error(`CSV validation failed: ${errors.length} error(s)`);
        setCsvFile(null);
      }
    },
    [parseCSV]
  );

  // Manual email field management
  const handleAddEmailField = useCallback(() => {
    setMemberEmails([...memberEmails, '']);
    setMemberRoles([...memberRoles, 'member']);
  }, [memberEmails, memberRoles]);

  const handleEmailChange = useCallback(
    (index, value) => {
      const newEmails = [...memberEmails];
      newEmails[index] = value;
      setMemberEmails(newEmails);
    },
    [memberEmails]
  );

  const handleRoleChange = useCallback(
    (index, value) => {
      const newRoles = [...memberRoles];
      newRoles[index] = value;
      setMemberRoles(newRoles);
    },
    [memberRoles]
  );

  const handleRemoveMember = useCallback(
    (index) => {
      if (memberEmails.length <= 1) return;
      setMemberEmails(memberEmails.filter((_, i) => i !== index));
      setMemberRoles(memberRoles.filter((_, i) => i !== index));
    },
    [memberEmails, memberRoles]
  );

  // Get valid members for validation and preview
  const validMembers = useMemo(() => {
    return memberEmails
      .map((email, index) => ({
        email: email.trim(),
        role: memberRoles[index] || 'member',
        index,
      }))
      .filter((m) => m.email && validateEmail(m.email));
  }, [memberEmails, memberRoles, validateEmail]);

  // Navigation with validation
  const handleNext = useCallback(() => {
    setError('');

    if (step === 1) {
      if (!groupName.trim()) {
        setError('Please enter a group name');
        return;
      }
      if (groupName.trim().length < 3) {
        setError('Group name must be at least 3 characters');
        return;
      }
      if (groupName.trim().length > 100) {
        setError('Group name cannot exceed 100 characters');
        return;
      }
    }

    if (step === 2) {
      if (validMembers.length === 0) {
        setError('Please add at least one valid member with a valid email');
        return;
      }

      // Check for duplicates
      const emailSet = new Set();
      const duplicates = [];
      validMembers.forEach((m) => {
        const lower = m.email.toLowerCase();
        if (emailSet.has(lower)) {
          duplicates.push(lower);
        }
        emailSet.add(lower);
      });

      if (duplicates.length > 0) {
        setError(`Duplicate emails found: ${[...new Set(duplicates)].join(', ')}`);
        return;
      }
    }

    setStep(step + 1);
  }, [step, groupName, validMembers]);

  const handleBack = useCallback(() => {
    setStep(Math.max(1, step - 1));
  }, [step]);

  // Submit with batch processing and progress
  const handleSubmit = useCallback(
    async (e) => {
      e?.preventDefault();

      // Final validation
      if (validMembers.length === 0) {
        setError('No valid members to invite');
        return;
      }

      setLoading(true);
      setProgress({
        current: 0,
        total: validMembers.length + 1, // +1 for group creation
        message: 'Starting group creation...',
        failures: [],
        successCount: 0,
      });

      try {
        // Step 1: Create group (with audit logging)
        setProgress((prev) => ({
          ...prev,
          current: 1,
          message: '📝 Creating group...',
        }));

        const groupData = {
          name: groupName.trim(),
          type: groupType,
          description: description.trim(),
          members: validMembers.map((m) => ({ email: m.email, role: m.role })),
          createdBy: user?.id || user?._id,
        };

        const groupResponse = await api.post('/groups', groupData);
        const groupId = groupResponse.data.groupId || groupResponse.data._id;

        // Step 2: Send invitations with batch processing
        const batchSize = 5;
        const failures = [];
        let successCount = 0;

        for (let i = 0; i < validMembers.length; i += batchSize) {
          const batch = validMembers.slice(i, i + batchSize);
          const currentProgress = Math.min(i / batchSize + 1, validMembers.length);

          setProgress((prev) => ({
            ...prev,
            current: currentProgress + 1,
            message: `📧 Sending invitations (${Math.min(i + batchSize, validMembers.length)}/${validMembers.length})...`,
            successCount,
          }));

          try {
            const response = await api.post(`/groups/${groupId}/send-invitations`, {
              members: batch.map((m) => ({ email: m.email, role: m.role })),
              batchIndex: Math.floor(i / batchSize) + 1,
            });
            successCount += response.data.successCount || batch.length;
          } catch (batchErr) {
            console.error(`Batch ${Math.floor(i / batchSize) + 1} failed:`, batchErr);
            failures.push({
              batch: Math.floor(i / batchSize) + 1,
              error: batchErr.response?.data?.message || 'Failed to send batch',
              members: batch.map((m) => m.email),
              count: batch.length,
            });
          }
        }

        // Final state
        setProgress({
          current: validMembers.length + 1,
          total: validMembers.length + 1,
          message:
            failures.length === 0
              ? '✅ Group created and all invitations sent!'
              : '⚠️ Group created but some invitations failed',
          failures,
          successCount,
        });

        toast.success(`✅ Group "${groupName}" created!`);

        // Move to confirmation step
        setStep(4);

        // Auto-navigate after delay if all successful
        if (failures.length === 0) {
          setTimeout(() => navigate(`/groups/${groupId}`), 2000);
        }
      } catch (err) {
        console.error('Group creation error:', err);
        const errorMsg = err.response?.data?.message || err.message || 'Failed to create group';
        setError(`❌ ${errorMsg}`);
        toast.error(errorMsg);
        setProgress({ current: 0, total: 0, message: '', failures: [], successCount: 0 });
      } finally {
        setLoading(false);
      }
    },
    [groupName, groupType, description, validMembers, user, navigate]
  );

  // STEP 1: Basic Information
  const renderStep1 = () => (
    <div className="step-container">
      <div className="step-header">
        <h2>📋 Group Information</h2>
        <p>Create a new community savings group</p>
      </div>

      <div className="form-group">
        <label htmlFor="groupName" className="form-label">
          Group Name <span className="required">*</span>
        </label>
        <input
          id="groupName"
          type="text"
          placeholder="e.g., Women's Savings Circle"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          maxLength={100}
          className="input-field"
        />
        <small className="form-help">{groupName.length}/100 characters</small>
      </div>

      <div className="form-group">
        <label htmlFor="groupType" className="form-label">
          Group Type <span className="required">*</span>
        </label>
        <select
          id="groupType"
          value={groupType}
          onChange={(e) => setGroupType(e.target.value)}
          className="input-field"
        >
          {GROUP_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
        <small className="form-help">
          {GROUP_TYPES.find((t) => t.value === groupType)?.description}
        </small>
      </div>

      <div className="form-group">
        <label htmlFor="description" className="form-label">
          Description <span className="optional">(Optional)</span>
        </label>
        <textarea
          id="description"
          placeholder="Describe your group's goals and objectives..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          rows={4}
          className="input-field"
        />
        <small className="form-help">{description.length}/500 characters</small>
      </div>
    </div>
  );

  // STEP 2: Add Members
  const renderStep2 = () => (
    <div className="step-container">
      <div className="step-header">
        <h2>👥 Add Members</h2>
        <p>Invite members and assign roles</p>
      </div>

      {/* CSV Upload Section */}
      <div className="form-group csv-upload-section">
        <label htmlFor="csvFile" className="form-label">
          <Upload size={16} /> Upload CSV File <span className="optional">(Optional)</span>
        </label>
        <input
          id="csvFile"
          type="file"
          accept=".csv,.txt"
          onChange={handleCsvUpload}
          className="input-field file-input"
        />
        <small className="form-help">
          Format: email,role (one per line). Example: john@example.com,treasurer
        </small>

        {csvFile && (
          <div className="success-box">
            <CheckCircle size={16} /> Loaded from: <strong>{csvFile}</strong>
          </div>
        )}

        {csvErrors.length > 0 && (
          <div className="error-box">
            <AlertCircle size={16} /> CSV Errors:
            <ul className="error-list">
              {csvErrors.slice(0, 5).map((err, i) => (
                <li key={i}>{err}</li>
              ))}
              {csvErrors.length > 5 && <li>...and {csvErrors.length - 5} more</li>}
            </ul>
          </div>
        )}
      </div>

      <div className="divider">OR</div>

      {/* Manual Entry Section */}
      <div className="form-group">
        <label className="form-label">Manual Entry</label>
        <div className="members-list">
          {memberEmails.map((email, index) => (
            <div key={index} className="member-entry">
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => handleEmailChange(index, e.target.value)}
                className="input-field email-input"
                aria-label={`Member ${index + 1} email`}
              />
              <select
                value={memberRoles[index] || 'member'}
                onChange={(e) => handleRoleChange(index, e.target.value)}
                className="input-field role-select"
                title="Select member role"
              >
                {MEMBER_ROLES.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
              {memberEmails.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveMember(index)}
                  className="btn-remove"
                  title="Remove member"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>

        <button type="button" onClick={handleAddEmailField} className="btn-add-member">
          + Add Member
        </button>
      </div>

      {validMembers.length > 0 && (
        <div className="valid-count">
          <CheckCircle size={16} /> {validMembers.length} valid member(s) ready
        </div>
      )}
    </div>
  );

  // STEP 3: Preview
  const renderStep3 = () => (
    <div className="step-container">
      <div className="step-header">
        <h2>
          <Eye size={20} /> Review & Confirm
        </h2>
        <p>Verify group details before creating</p>
      </div>

      {/* Group Details Summary */}
      <div className="preview-section">
        <h3>Group Details</h3>
        <div className="preview-grid">
          <div className="preview-item">
            <span className="preview-label">Group Name:</span>
            <span className="preview-value">{groupName}</span>
          </div>
          <div className="preview-item">
            <span className="preview-label">Type:</span>
            <span className="preview-value">
              {GROUP_TYPES.find((t) => t.value === groupType)?.label}
            </span>
          </div>
          {description && (
            <div className="preview-item full-width">
              <span className="preview-label">Description:</span>
              <span className="preview-value">{description}</span>
            </div>
          )}
          <div className="preview-item">
            <span className="preview-label">Total Members:</span>
            <span className="preview-value badge">{validMembers.length}</span>
          </div>
        </div>
      </div>

      {/* Members List */}
      <div className="members-preview">
        <h3>Members to Invite ({validMembers.length})</h3>
        <div className="members-grid">
          {validMembers.map((member, index) => {
            const roleInfo = MEMBER_ROLES.find((r) => r.value === member.role);
            return (
              <div key={index} className="member-card">
                <div className="member-email">{member.email}</div>
                <div className="member-role-badge" title={roleInfo?.description}>
                  {roleInfo?.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Role Distribution */}
      <div className="role-distribution">
        <h4>Role Distribution</h4>
        {MEMBER_ROLES.map((role) => {
          const count = validMembers.filter((m) => m.role === role.value).length;
          return count > 0 ? (
            <div key={role.value} className="role-stat">
              <span>{role.label}:</span>
              <strong>{count}</strong>
            </div>
          ) : null;
        })}
      </div>

      <div className="info-box">
        <AlertCircle size={16} />
        <span>Click "Create Group" to create the group and send invitations</span>
      </div>
    </div>
  );

  // STEP 4: Confirmation & Progress
  const renderStep4 = () => (
    <div className="step-container">
      <div className="step-header">
        <h2>{progress.failures.length === 0 ? <>✅ Success!</> : <>⚠️ Completed with Issues</>}</h2>
        <p>{progress.message}</p>
      </div>

      {/* Progress Bar */}
      <div className="progress-section">
        <div className="progress-bar-container">
          <div
            className="progress-bar"
            role="progressbar"
            aria-valuenow={progress.current}
            aria-valuemin={0}
            aria-valuemax={progress.total}
            style={{ width: `${(progress.current / Math.max(progress.total, 1)) * 100}%` }}
          />
        </div>
        <div className="progress-text">
          {progress.current} of {progress.total} steps completed
        </div>
      </div>

      {/* Success Summary */}
      {progress.successCount > 0 && (
        <div className="success-box">
          <CheckCircle size={16} />
          <span>✅ {progress.successCount} member invitations sent successfully</span>
        </div>
      )}

      {/* Failures */}
      {progress.failures.length > 0 && (
        <div className="error-box">
          <AlertCircle size={16} /> Some invitations could not be sent:
          <ul className="failure-list">
            {progress.failures.map((failure, i) => (
              <li key={i}>
                <strong>Batch {failure.batch}:</strong> {failure.error} ({failure.count} member(s))
              </li>
            ))}
          </ul>
        </div>
      )}

      {progress.current === progress.total && (
        <div className="completion-message">
          <p>✨ Group "{groupName}" has been created successfully!</p>
          {progress.failures.length === 0 && (
            <p className="redirecting">Redirecting to group details...</p>
          )}
        </div>
      )}
    </div>
  );

  // Main render
  return (
    <div className="create-group-wrapper">
      <div className="create-group-container">
        {/* Step Indicator */}
        <div className="step-indicator">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`step-dot ${step >= s ? 'active' : ''} ${step === s ? 'current' : ''}`}
              title={['Info', 'Members', 'Preview', 'Confirm'][s - 1]}
            >
              {step === s ? '●' : s}
            </div>
          ))}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="alert alert-error" role="alert">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Step Content */}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}

        {/* Navigation Buttons */}
        {step < 4 && (
          <div className="button-group">
            {step > 1 && (
              <button
                onClick={handleBack}
                className="btn-secondary"
                disabled={loading}
                type="button"
              >
                ← Back
              </button>
            )}
            {step < 3 && (
              <button onClick={handleNext} className="btn-primary" disabled={loading} type="button">
                Next →
              </button>
            )}
            {step === 3 && (
              <button
                onClick={handleSubmit}
                disabled={loading || validMembers.length === 0}
                className="btn-primary btn-submit"
                type="button"
              >
                <Send size={16} />
                {loading ? 'Creating...' : 'Create Group'}
              </button>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="button-group">
            {progress.failures.length > 0 && (
              <button
                onClick={() => {
                  setStep(2);
                  setError('');
                }}
                className="btn-secondary"
              >
                ← Retry Failed Invitations
              </button>
            )}
            <button
              onClick={() => navigate(progress.failures.length === 0 ? '/dashboard' : '/groups')}
              className="btn-primary"
            >
              {progress.failures.length === 0 ? 'Return to Dashboard' : 'View Groups'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateGroupV2;
