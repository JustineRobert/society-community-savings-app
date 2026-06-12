// src/pages/CreateGroup.jsx
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { toast } from 'react-toastify';
import './CreateGroup.css';

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
];

const CreateGroup = () => {
  const [step, setStep] = useState(1); // 1: Basic Info, 2: Members, 3: Preview, 4: Submit
  const [groupName, setGroupName] = useState('');
  const [groupType, setGroupType] = useState('savings');
  const [memberEmails, setMemberEmails] = useState(['']);
  const [csvFile, setCsvFile] = useState(null);
  const [csvErrors, setCsvErrors] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });
  const navigate = useNavigate();

  const validateEmails = useCallback((emails) => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emails.filter((email) => email.trim() && !emailRegex.test(email.trim()));
  }, []);

  const parseCSV = useCallback(
    (file) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target.result;
          const lines = text.split('\n').filter((line) => line.trim());
          const emails = [];
          const errors = [];

          lines.forEach((line, index) => {
            const parts = line.split(',').map((p) => p.trim());
            if (parts.length >= 1) {
              const email = parts[0];
              if (email) {
                emails.push(email);
              } else {
                errors.push(`Line ${index + 1}: Empty email`);
              }
            }
          });

          const invalidEmails = validateEmails(emails);
          if (invalidEmails.length > 0) {
            errors.push(`Invalid emails: ${invalidEmails.join(', ')}`);
          }

          if (errors.length > 0) {
            reject(errors);
          } else {
            resolve(emails);
          }
        };
        reader.onerror = () => reject(['Failed to read file']);
        reader.readAsText(file);
      });
    },
    [validateEmails]
  );

  const handleCsvUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const emails = await parseCSV(file);
      setMemberEmails(emails);
      setCsvFile(file);
      setCsvErrors([]);
      toast.success(`Loaded ${emails.length} members from CSV`);
    } catch (errors) {
      setCsvErrors(errors);
      toast.error('CSV validation failed');
    }
  };

  const handleAddEmailField = () => {
    setMemberEmails([...memberEmails, '']);
  };

  const handleEmailChange = (index, value) => {
    const newEmails = [...memberEmails];
    newEmails[index] = value;
    setMemberEmails(newEmails);
  };

  const handleNext = () => {
    if (step === 1 && !groupName.trim()) {
      setError('Please enter a group name');
      return;
    }
    if (step === 2) {
      const invalid = validateEmails(memberEmails.filter((e) => e.trim()));
      if (invalid.length > 0) {
        setError(`Invalid emails: ${invalid.join(', ')}`);
        return;
      }
      if (memberEmails.filter((e) => e.trim()).length === 0) {
        setError('Please add at least one member');
        return;
      }
    }
    setError('');
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setProgress({ current: 0, total: memberEmails.length, message: 'Creating group...' });

    try {
      const members = memberEmails.filter((email) => email.trim());
      setProgress({ current: 1, total: members.length, message: 'Sending invitations...' });

      await api.post('/groups', {
        name: groupName,
        type: groupType,
        members,
      });

      setProgress({
        current: members.length,
        total: members.length,
        message: 'Group created successfully!',
      });
      toast.success('Group created successfully!');
      navigate('/');
    } catch (err) {
      console.error(err);
      setError('Failed to create group. Try again.');
      setProgress({ current: 0, total: 0, message: '' });
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="step-content">
      <h3>Basic Information</h3>
      <div className="form-group">
        <label htmlFor="groupName">Group Name *</label>
        <input
          id="groupName"
          type="text"
          placeholder="Enter group name"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          required
          className="input-field"
        />
      </div>
      <div className="form-group">
        <label htmlFor="groupType">Group Type *</label>
        <select
          id="groupType"
          value={groupType}
          onChange={(e) => setGroupType(e.target.value)}
          className="input-field"
        >
          {GROUP_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label} - {type.description}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="step-content">
      <h3>Add Members</h3>
      <div className="form-group">
        <label>Upload CSV (optional)</label>
        <input type="file" accept=".csv" onChange={handleCsvUpload} className="input-field" />
        {csvErrors.length > 0 && (
          <div className="error-list">
            {csvErrors.map((err, i) => (
              <p key={i} className="error-message">
                {err}
              </p>
            ))}
          </div>
        )}
      </div>
      <div className="form-group">
        <label>Member Emails</label>
        {memberEmails.map((email, index) => (
          <input
            key={index}
            type="email"
            placeholder={`Member ${index + 1} Email`}
            value={email}
            onChange={(e) => handleEmailChange(index, e.target.value)}
            className="input-field"
          />
        ))}
        <button type="button" onClick={handleAddEmailField} className="add-email-btn">
          + Add Another
        </button>
      </div>
    </div>
  );

  const renderStep3 = () => {
    const validMembers = memberEmails.filter((e) => e.trim() && validateEmails([e]).length === 0);
    return (
      <div className="step-content">
        <h3>Preview & Confirm</h3>
        <div className="preview-summary">
          <h4>Group Details</h4>
          <p>
            <strong>Name:</strong> {groupName}
          </p>
          <p>
            <strong>Type:</strong> {GROUP_TYPES.find((t) => t.value === groupType)?.label}
          </p>
          <p>
            <strong>Members:</strong> {validMembers.length}
          </p>
          <h4>Member List</h4>
          <ul>
            {validMembers.map((email, i) => (
              <li key={i}>{email}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  const renderStep4 = () => (
    <div className="step-content">
      <h3>Creating Group</h3>
      {progress.total > 0 && (
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${(progress.current / progress.total) * 100}%` }}
          ></div>
          <p>{progress.message}</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="create-group-container">
      <h2>Create New Group</h2>
      {error && <p className="error-message">{error}</p>}

      <div className="step-indicator">
        <span className={step >= 1 ? 'active' : ''}>1. Info</span>
        <span className={step >= 2 ? 'active' : ''}>2. Members</span>
        <span className={step >= 3 ? 'active' : ''}>3. Preview</span>
        <span className={step >= 4 ? 'active' : ''}>4. Create</span>
      </div>

      <form onSubmit={handleSubmit}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}

        <div className="form-actions">
          {step > 1 && step < 4 && (
            <button type="button" onClick={handleBack} className="btn-secondary">
              Back
            </button>
          )}
          {step < 3 && (
            <button type="button" onClick={handleNext} className="btn-primary">
              Next
            </button>
          )}
          {step === 3 && (
            <button
              type="submit"
              disabled={loading}
              className={`submit-btn ${loading ? 'loading' : ''}`}
            >
              {loading ? 'Creating...' : 'Create Group'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default CreateGroup;
