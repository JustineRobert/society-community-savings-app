import React, { useState, useEffect } from 'react';
import './LegalDocuments.css';

/**
 * LegalDocuments Component
 * Displays Terms of Service and Privacy Policy modals
 * Allows users to accept/view full legal documents
 */

const LegalDocuments = () => {
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [termsData, setTermsData] = useState(null);
  const [privacyData, setPrivacyData] = useState(null);
  const [acceptanceStatus, setAcceptanceStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState(null);

  // Fetch legal documents
  const fetchLegalDocuments = async () => {
    setLoading(true);
    try {
      const [termsRes, privacyRes, statusRes] = await Promise.all([
        fetch('/api/legal/terms-of-service'),
        fetch('/api/legal/privacy-policy'),
        fetch('/api/legal/acceptance-status', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }),
      ]);

      if (!termsRes.ok || !privacyRes.ok) {
        throw new Error('Failed to fetch legal documents');
      }

      const termsJson = await termsRes.json();
      const privacyJson = await privacyRes.json();
      const statusJson = statusRes.ok ? await statusRes.json() : null;

      setTermsData(termsJson.data || termsJson.document);
      setPrivacyData(privacyJson.data || privacyJson.document);
      setAcceptanceStatus(statusJson?.data || statusJson);
      setError(null);
    } catch (err) {
      console.error('Error fetching legal documents:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Accept terms and privacy
  const handleAcceptTerms = async () => {
    setAccepting(true);
    try {
      const response = await fetch('/api/legal/accept-terms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error('Failed to record acceptance');
      }

      const result = await response.json();
      setAcceptanceStatus({
        ...acceptanceStatus,
        hasAccepted: true,
        acceptedTerms: true,
        acceptedPrivacy: true,
        acceptedAt: result.data.acceptedAt,
      });
      setShowTermsModal(false);
      setShowPrivacyModal(false);
      setError(null);
    } catch (err) {
      console.error('Error accepting terms:', err);
      setError(err.message);
    } finally {
      setAccepting(false);
    }
  };

  useEffect(() => {
    fetchLegalDocuments();
  }, []);

  if (loading) {
    return <div className="legal-documents-loading">Loading legal documents...</div>;
  }

  const hasAcceptedAll = acceptanceStatus?.acceptedTerms && acceptanceStatus?.acceptedPrivacy;

  return (
    <div className="legal-documents">
      {error && <div className="legal-error-message">{error}</div>}

      {!hasAcceptedAll && (
        <div className="legal-acceptance-prompt">
          <h3>Legal Documents</h3>
          <p>Please review and accept our Terms of Service and Privacy Policy to continue.</p>
          {acceptanceStatus?.acceptedTerms && (
            <p className="legal-status-accepted">✓ Terms of Service accepted</p>
          )}
          {acceptanceStatus?.acceptedPrivacy && (
            <p className="legal-status-accepted">✓ Privacy Policy accepted</p>
          )}
        </div>
      )}

      <div className="legal-links">
        <button className="legal-link-btn" onClick={() => setShowTermsModal(true)}>
          Terms of Service
        </button>
        <button className="legal-link-btn" onClick={() => setShowPrivacyModal(true)}>
          Privacy Policy
        </button>
      </div>

      {/* Terms of Service Modal */}
      {showTermsModal && termsData && (
        <div className="legal-modal-overlay">
          <div className="legal-modal">
            <div className="legal-modal-header">
              <h2>{termsData.title || 'Terms of Service'}</h2>
              <p className="legal-modal-date">
                Effective: {termsData.effectiveDate} | Version: {termsData.version}
              </p>
              <button className="legal-modal-close" onClick={() => setShowTermsModal(false)}>
                ×
              </button>
            </div>

            <div className="legal-modal-content">
              <div className="legal-document-text">
                {typeof termsData.content === 'string' ? (
                  <pre>{termsData.content}</pre>
                ) : (
                  termsData.content
                )}
              </div>
            </div>

            <div className="legal-modal-footer">
              <button className="legal-btn-secondary" onClick={() => setShowTermsModal(false)}>
                Close
              </button>
              {!acceptanceStatus?.acceptedTerms && (
                <button
                  className="legal-btn-primary"
                  onClick={handleAcceptTerms}
                  disabled={accepting}
                >
                  {accepting ? 'Accepting...' : 'Accept Terms'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Privacy Policy Modal */}
      {showPrivacyModal && privacyData && (
        <div className="legal-modal-overlay">
          <div className="legal-modal">
            <div className="legal-modal-header">
              <h2>{privacyData.title || 'Privacy Policy'}</h2>
              <p className="legal-modal-date">
                Effective: {privacyData.effectiveDate} | Version: {privacyData.version}
              </p>
              <button className="legal-modal-close" onClick={() => setShowPrivacyModal(false)}>
                ×
              </button>
            </div>

            <div className="legal-modal-content">
              <div className="legal-document-text">
                {typeof privacyData.content === 'string' ? (
                  <pre>{privacyData.content}</pre>
                ) : (
                  privacyData.content
                )}
              </div>
            </div>

            <div className="legal-modal-footer">
              <button className="legal-btn-secondary" onClick={() => setShowPrivacyModal(false)}>
                Close
              </button>
              {!acceptanceStatus?.acceptedPrivacy && (
                <button
                  className="legal-btn-primary"
                  onClick={handleAcceptTerms}
                  disabled={accepting}
                >
                  {accepting ? 'Accepting...' : 'Accept Privacy Policy'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LegalDocuments;
