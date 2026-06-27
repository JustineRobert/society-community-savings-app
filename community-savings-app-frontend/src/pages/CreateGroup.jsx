// ============================================================================
// TITech Community Capital – Create Group Page
// File: frontend/src/pages/CreateGroup.jsx
// Production-grade
// ============================================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../services/api';
import './CreateGroup.css';

/**
 * CreateGroup
 *
 * - Multi-step form (Info → Members → Preview → Submit)
 * - CSV upload with robust parsing and validation (no external deps)
 * - Accessible form controls and keyboard-friendly actions
 * - Abortable network requests and clear loading/progress UI
 * - Defensive input sanitization and helpful toasts/errors
 */

const GROUP_TYPES = [
  { value: 'savings', label: 'Savings Group', description: 'Traditional community savings pool' },
  { value: 'investment', label: 'Investment Group', description: 'Focus on investment opportunities' },
  { value: 'community', label: 'Community Support', description: 'General community support and welfare' },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const MAX_CSV_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

export default function CreateGroup() {
  const navigate = useNavigate();

  // Form state
  const [step, setStep] = useState(1);
  const [groupName, setGroupName] = useState('');
  const [groupType, setGroupType] = useState(GROUP_TYPES[0].value);
  const [memberEmails, setMemberEmails] = useState(['']);
  const [csvFileName, setCsvFileName] = useState(null);
  const [csvErrors, setCsvErrors] = useState([]);
  const [error, setError] = useState(null);

  // Network / progress state
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });
  const abortRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (abortRef.current) {
        try {
          abortRef.current.abort();
        } catch (_) {}
      }
    };
  }, []);

  // Helpers
  const sanitizeEmail = useCallback((s) => (s || '').trim().toLowerCase(), []);
  const isValidEmail = useCallback((s) => EMAIL_REGEX.test(String(s || '').trim()), []);

  const validateEmails = useCallback((emails) => {
    const invalid = [];
    const unique = new Set();
    const cleaned = [];

    emails.forEach((raw) => {
      const e = sanitizeEmail(raw);
      if (!e) return;
      if (!isValidEmail(e)) {
        invalid.push(e || raw);
        return;
      }
      if (!unique.has(e)) {
        unique.add(e);
        cleaned.push(e);
      }
    });

    return { invalid, cleaned };
  }, [sanitizeEmail, isValidEmail]);

  // CSV parsing (simple, robust)
  const parseCSV = useCallback(
    (file) =>
      new Promise((resolve, reject) => {
        if (!file) return reject(['No file provided']);
        if (file.size > MAX_CSV_SIZE_BYTES) {
          return reject([`CSV file too large (max ${MAX_CSV_SIZE_BYTES / 1024 / 1024} MB)`]);
        }

        const reader = new FileReader();

        reader.onerror = () => {
          reject(['Failed to read file']);
        };

        reader.onload = () => {
          try {
            const text = String(reader.result || '');
            // Normalize line endings and split
            const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
            const emails = [];
            const errors = [];

            lines.forEach((rawLine, idx) => {
              const line = rawLine.trim();
              if (!line) return;
              // Support CSV with multiple columns: take first non-empty column
              const cols = line.split(',').map((c) => c.trim()).filter(Boolean);
              const candidate = cols.length > 0 ? cols[0] : '';
              if (!candidate) {
                errors.push(`Line ${idx + 1}: empty`);
                return;
              }
              emails.push(candidate);
            });

            const { invalid, cleaned } = validateEmails(emails);
            if (invalid.length > 0) {
              errors.push(`Invalid emails: ${invalid.join(', ')}`);
            }

            if (errors.length > 0) {
              reject(errors);
            } else {
              resolve(cleaned);
            }
          } catch (err) {
            reject(['Failed to parse CSV']);
          }
        };

        reader.readAsText(file, 'utf-8');
      }),
    [validateEmails]
  );

  // Handlers
  const handleCsvUpload = useCallback(
    async (e) => {
      setCsvErrors([]);
      setError(null);
      const file = e?.target?.files?.[0];
      if (!file) return;
      setCsvFileName(file.name);

      try {
        const emails = await parseCSV(file);
        setMemberEmails(emails.length ? emails : ['']);
        toast.success(`Loaded ${emails.length} members from CSV`);
      } catch (errs) {
        const arr = Array.isArray(errs) ? errs : [String(errs || 'CSV error')];
        setCsvErrors(arr);
        toast.error('CSV validation failed');
      }
    },
    [parseCSV]
  );

  const handleAddEmailField = useCallback(() => {
    setMemberEmails((prev) => [...prev, '']);
  }, []);

  const handleRemoveEmailField = useCallback((index) => {
    setMemberEmails((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleEmailChange = useCallback((index, value) => {
    setMemberEmails((prev) => prev.map((v, i) => (i === index ? value : v)));
  }, []);

  const handleNext = useCallback(() => {
    setError(null);

    if (step === 1) {
      if (!groupName.trim()) {
        setError('Please enter a group name');
        return;
      }
    }

    if (step === 2) {
      const raw = memberEmails.slice();
      const { invalid, cleaned } = validateEmails(raw);
      if (cleaned.length === 0) {
        setError('Please add at least one valid member email');
        return;
      }
      if (invalid.length > 0) {
        setError(`Invalid emails: ${invalid.join(', ')}`);
        return;
      }
      // Normalize memberEmails to cleaned unique list
      setMemberEmails(cleaned);
    }

    setStep((s) => Math.min(4, s + 1));
  }, [step, groupName, memberEmails, validateEmails]);

  const handleBack = useCallback(() => {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e?.preventDefault?.();
      setError(null);

      // Final validation
      if (!groupName.trim()) {
        setError('Group name is required');
        setStep(1);
        return;
      }

      const { invalid, cleaned } = validateEmails(memberEmails);
      if (cleaned.length === 0) {
        setError('Please add at least one valid member email');
        setStep(2);
        return;
      }
      if (invalid.length > 0) {
        setError(`Invalid emails: ${invalid.join(', ')}`);
        setStep(2);
        return;
      }

      setLoading(true);
      setProgress({ current: 0, total: cleaned.length, message: 'Creating group...' });

      // Abort previous request if any
      if (abortRef.current) {
        try {
          abortRef.current.abort();
        } catch (_) {}
      }
      abortRef.current = new AbortController();

      try {
        // Create group
        const payload = {
          name: groupName.trim(),
          type: groupType,
          members: cleaned,
        };

        // Use signal for abortable request
        const resp = await api.post('/groups', payload, {
          signal: abortRef.current.signal,
        });

        // If API returns progress info, use it; otherwise simulate progress
        if (resp?.data?.progress) {
          // If backend streams progress, handle accordingly (not implemented here)
          setProgress({ current: resp.data.progress.current || cleaned.length, total: cleaned.length, message: resp.data.progress.message || 'Done' });
        } else {
          // Simulate incremental progress for UX
          for (let i = 1; i <= cleaned.length; i++) {
            if (!mountedRef.current) break;
            setProgress({ current: i, total: cleaned.length, message: `Inviting ${i} of ${cleaned.length}` });
            // small delay for UX; remove in production if backend provides real progress
            // eslint-disable-next-line no-await-in-loop
            await new Promise((r) => setTimeout(r, 80));
          }
        }

        toast.success('Group created successfully');
        // Navigate to group page or dashboard
        navigate('/groups', { replace: true });
      } catch (err) {
        if (err?.name === 'AbortError') {
          toast.info('Group creation cancelled');
          return;
        }

        console.error('CreateGroup error', err);
        const msg = err?.response?.data?.message || err?.message || 'Failed to create group';
        setError(msg);
        toast.error(msg);
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          setProgress((p) => ({ ...p, message: '' }));
        }
      }
    },
    [groupName, groupType, memberEmails, validateEmails, navigate]
  );

  // Derived values for preview
  const previewMembers = useMemo(() => {
    const { cleaned } = validateEmails(memberEmails);
    return cleaned;
  }, [memberEmails, validateEmails]);

  // UI
  return (
    <main className="create-group-page p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Create New Group</h1>

      <div className="card p-4 mb-4">
        <div className="step-indicator flex gap-3 text-sm">
          <div className={`step ${step >= 1 ? 'active' : ''}`}>1. Info</div>
          <div className={`step ${step >= 2 ? 'active' : ''}`}>2. Members</div>
          <div className={`step ${step >= 3 ? 'active' : ''}`}>3. Preview</div>
          <div className={`step ${step >= 4 ? 'active' : ''}`}>4. Create</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card p-6" aria-live="polite">
        {error && (
          <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 p-3 rounded">
            {error}
          </div>
        )}

        {step === 1 && (
          <>
            <fieldset disabled={loading} aria-disabled={loading}>
              <legend className="sr-only">Group basic information</legend>

              <label htmlFor="groupName" className="block text-sm font-medium mb-1">
                Group Name <span aria-hidden="true" className="text-red-600">*</span>
              </label>
              <input
                id="groupName"
                name="groupName"
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="input-field w-full mb-4"
                placeholder="e.g., Katosi Savings Group"
                required
                aria-required="true"
              />

              <label htmlFor="groupType" className="block text-sm font-medium mb-1">
                Group Type
              </label>
              <select
                id="groupType"
                name="groupType"
                value={groupType}
                onChange={(e) => setGroupType(e.target.value)}
                className="input-field w-full mb-4"
              >
                {GROUP_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label} — {t.description}
                  </option>
                ))}
              </select>
            </fieldset>
          </>
        )}

        {step === 2 && (
          <>
            <fieldset disabled={loading} aria-disabled={loading}>
              <legend className="sr-only">Add members</legend>

              <label className="block text-sm font-medium mb-1">Upload CSV (optional)</label>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleCsvUpload}
                className="input-field mb-2"
                aria-describedby="csv-help"
              />
              <div id="csv-help" className="text-xs text-gray-500 mb-3">
                CSV should contain one email per line or first column as email. Max file size 2MB.
              </div>

              {csvFileName && <div className="text-sm mb-2">Loaded file: {csvFileName}</div>}
              {csvErrors.length > 0 && (
                <div className="mb-3 text-sm text-red-700">
                  {csvErrors.map((err, i) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <div key={i}>{err}</div>
                  ))}
                </div>
              )}

              <label className="block text-sm font-medium mb-1">Member Emails</label>
              <div className="mb-3 space-y-2">
                {memberEmails.map((email, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => handleEmailChange(idx, e.target.value)}
                      placeholder={`Member ${idx + 1} email`}
                      className="input-field flex-1"
                      aria-label={`Member ${idx + 1} email`}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveEmailField(idx)}
                      className="btn-secondary"
                      aria-label={`Remove member ${idx + 1}`}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={handleAddEmailField} className="btn-primary">
                  + Add another
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // quick dedupe & validate
                    const { cleaned } = validateEmails(memberEmails);
                    setMemberEmails(cleaned.length ? cleaned : ['']);
                    toast.info('Normalized member list');
                  }}
                  className="btn-secondary"
                >
                  Normalize list
                </button>
              </div>
            </fieldset>
          </>
        )}

        {step === 3 && (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-medium mb-2">Preview</h2>
              <p className="text-sm text-gray-600 mb-2">
                Confirm group details before creating. You can go back to edit.
              </p>

              <div className="bg-gray-50 p-3 rounded mb-3">
                <p>
                  <strong>Name:</strong> {groupName}
                </p>
                <p>
                  <strong>Type:</strong>{' '}
                  {GROUP_TYPES.find((t) => t.value === groupType)?.label ?? groupType}
                </p>
                <p>
                  <strong>Members:</strong> {previewMembers.length}
                </p>
              </div>

              <div className="mb-3">
                <h3 className="text-sm font-medium mb-1">Member list</h3>
                <div className="max-h-48 overflow-auto border rounded p-2 bg-white">
                  {previewMembers.length === 0 ? (
                    <div className="text-sm text-gray-500">No members added</div>
                  ) : (
                    <ul className="text-sm space-y-1">
                      {previewMembers.map((m) => (
                        <li key={m} className="truncate">
                          {m}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-medium mb-2">Creating group</h2>
              <div className="mb-2 text-sm text-gray-600">{progress.message || 'Working…'}</div>
              <div className="w-full bg-gray-200 rounded h-3 overflow-hidden mb-2">
                <div
                  className="bg-blue-600 h-3"
                  style={{
                    width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : '0%',
                    transition: 'width 200ms linear',
                  }}
                />
              </div>
              <div className="text-xs text-gray-500">
                {progress.total > 0 ? `${progress.current} / ${progress.total}` : ''}
              </div>
            </div>
          </>
        )}

        <div className="form-actions mt-6 flex gap-3">
          {step > 1 && (
            <button type="button" onClick={handleBack} className="btn-secondary" disabled={loading}>
              Back
            </button>
          )}

          {step < 3 && (
            <button type="button" onClick={handleNext} className="btn-primary" disabled={loading}>
              Next
            </button>
          )}

          {step === 3 && (
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Creating…' : 'Create Group'}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              navigate(-1);
            }}
            className="btn-ghost"
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </form>
    </main>
  );
}
