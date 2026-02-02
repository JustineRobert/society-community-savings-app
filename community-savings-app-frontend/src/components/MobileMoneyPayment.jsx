// src/components/MobileMoneyPayment.jsx
// ============================================================================
// Mobile Money Payment Component
// Integrates MTN MoMo and Airtel Money payments
// ============================================================================

import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../services/api';
import { AlertCircle, CheckCircle, Clock, XCircle, Phone, DollarSign } from 'lucide-react';
import './MobileMoneyPayment.css';

const MobileMoneyPayment = ({
  amount = 0,
  currency = 'XAF',
  groupId = null,
  contributionId = null,
  onPaymentSuccess = null,
  onPaymentCancel = null,
}) => {
  const [step, setStep] = useState('provider'); // provider, phone, processing, complete
  const [provider, setProvider] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [transactionId, setTransactionId] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [error, setError] = useState(null);
  const [pollingInterval, setPollingInterval] = useState(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  /**
   * Format phone number
   */
  const formatPhoneNumber = (number) => {
    // Remove any non-digit characters except +
    let cleaned = number.replace(/[^\d+]/g, '');

    // Ensure it starts with +
    if (!cleaned.startsWith('+')) {
      // If no country code, add +237 (Cameroon default)
      if (!cleaned.startsWith('0')) {
        cleaned = '+237' + cleaned;
      } else {
        // Replace leading 0 with country code
        cleaned = '+237' + cleaned.substring(1);
      }
    }

    return cleaned;
  };

  /**
   * Validate phone number
   */
  const validatePhoneNumber = (number) => {
    const formatted = formatPhoneNumber(number);
    const regex = /^\+?[1-9]\d{1,14}$/;
    return regex.test(formatted);
  };

  /**
   * Initiate payment
   */
  const handleInitiatePayment = async (e) => {
    e.preventDefault();

    if (!provider) {
      setError('Please select a payment provider');
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      setError('Please enter a valid phone number');
      return;
    }

    if (amount <= 0) {
      setError('Invalid payment amount');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/api/payments/initiate', {
        provider,
        phoneNumber: formatPhoneNumber(phoneNumber),
        amount,
        currency,
        groupId,
        contributionId,
        description: `Community Savings Contribution - ${new Date().toLocaleDateString()}`,
      });

      const { transactionId: txId, status } = response.data;

      setTransactionId(txId);
      setPaymentStatus(status);
      setStep('processing');

      // Start polling for payment status
      startStatusPolling(txId);

      toast.info('Payment initiated. Please complete the USSD prompt on your phone.');
    } catch (err) {
      const errorMsg = err?.response?.data?.message || err.message || 'Failed to initiate payment';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Poll payment status
   */
  const startStatusPolling = (txId) => {
    let pollCount = 0;
    const maxPolls = 60; // Poll for up to 5 minutes (60 * 5 second intervals)

    const interval = setInterval(async () => {
      pollCount++;

      try {
        const response = await api.get(`/api/payments/status/${txId}`);
        const { status } = response.data;

        setPaymentStatus(status);

        if (status === 'COMPLETED') {
          clearInterval(interval);
          setStep('complete');
          toast.success('Payment completed successfully!');

          if (onPaymentSuccess) {
            onPaymentSuccess(response.data);
          }
        } else if (status === 'FAILED') {
          clearInterval(interval);
          setError('Payment failed. Please try again.');
          setStep('complete');
          toast.error('Payment failed');
        } else if (status === 'CANCELLED') {
          clearInterval(interval);
          setError('Payment was cancelled.');
          setStep('complete');
        } else if (pollCount > maxPolls) {
          clearInterval(interval);
          setError('Payment confirmation timeout. Please check your account.');
          toast.warning(
            'Payment timeout. Please verify your account for any pending transactions.'
          );
        }
      } catch (err) {
        console.error('Error checking payment status:', err);
        // Continue polling even if status check fails
        if (pollCount > maxPolls) {
          clearInterval(interval);
          setError('Unable to verify payment. Please check manually.');
        }
      }
    }, 5000); // Poll every 5 seconds

    setPollingInterval(interval);
  };

  /**
   * Render provider selection step
   */
  const renderProviderStep = () => (
    <div className="payment-step">
      <h3 className="payment-title">Select Payment Provider</h3>
      <p className="payment-subtitle">Choose your preferred mobile money service</p>

      <div className="provider-grid">
        {/* MTN MoMo */}
        <label
          className={`provider-card ${provider === 'MTN_MOMO' ? 'selected' : ''}`}
        >
          <input
            type="radio"
            name="provider"
            value="MTN_MOMO"
            checked={provider === 'MTN_MOMO'}
            onChange={(e) => setProvider(e.target.value)}
            className="hidden"
          />
          <div className="provider-content">
            <div className="provider-logo mtn-logo">MTN</div>
            <div className="provider-info">
              <p className="provider-name">MTN MoMo</p>
              <p className="provider-desc">Fast & Secure</p>
            </div>
          </div>
        </label>

        {/* Airtel Money */}
        <label
          className={`provider-card ${provider === 'AIRTEL_MONEY' ? 'selected' : ''}`}
        >
          <input
            type="radio"
            name="provider"
            value="AIRTEL_MONEY"
            checked={provider === 'AIRTEL_MONEY'}
            onChange={(e) => setProvider(e.target.value)}
            className="hidden"
          />
          <div className="provider-content">
            <div className="provider-logo airtel-logo">AIRTEL</div>
            <div className="provider-info">
              <p className="provider-name">Airtel Money</p>
              <p className="provider-desc">Always Connected</p>
            </div>
          </div>
        </label>
      </div>

      <button
        onClick={() => setStep('phone')}
        disabled={!provider}
        className="btn-primary mt-6"
      >
        Continue
      </button>
    </div>
  );

  /**
   * Render phone number entry step
   */
  const renderPhoneStep = () => (
    <div className="payment-step">
      <h3 className="payment-title">Enter Phone Number</h3>
      <p className="payment-subtitle">
        Your {provider === 'MTN_MOMO' ? 'MTN MoMo' : 'Airtel Money'} phone number
      </p>

      <form onSubmit={handleInitiatePayment} className="payment-form">
        <div className="form-group">
          <label htmlFor="phoneNumber" className="form-label">
            <Phone className="form-icon" />
            Phone Number
          </label>
          <input
            id="phoneNumber"
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="e.g., +237 123 456 789 or 697 123 456"
            className="form-input"
            required
          />
          <small className="form-help">Include country code (e.g., +237 for Cameroon)</small>
        </div>

        <div className="form-group">
          <label className="form-label">
            <DollarSign className="form-icon" />
            Amount
          </label>
          <div className="amount-display">
            {currency} {amount.toLocaleString()}
          </div>
        </div>

        {error && (
          <div className="error-message">
            <AlertCircle />
            {error}
          </div>
        )}

        <div className="button-group">
          <button
            type="button"
            onClick={() => {
              setStep('provider');
              setError(null);
            }}
            className="btn-secondary"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={loading || !validatePhoneNumber(phoneNumber)}
            className="btn-primary"
          >
            {loading ? 'Processing...' : 'Pay Now'}
          </button>
        </div>
      </form>
    </div>
  );

  /**
   * Render processing step
   */
  const renderProcessingStep = () => (
    <div className="payment-step">
      <div className="processing-container">
        <div className={`status-icon ${paymentStatus}`}>
          {paymentStatus === 'PENDING' && <Clock size={40} />}
          {paymentStatus === 'PROCESSING' && <Clock size={40} />}
          {paymentStatus === 'COMPLETED' && <CheckCircle size={40} />}
          {paymentStatus === 'FAILED' && <XCircle size={40} />}
        </div>

        <h3 className="payment-title">
          {paymentStatus === 'PENDING' && 'Processing Payment...'}
          {paymentStatus === 'PROCESSING' && 'Completing Payment...'}
          {paymentStatus === 'COMPLETED' && 'Payment Successful!'}
          {paymentStatus === 'FAILED' && 'Payment Failed'}
        </h3>

        <p className="payment-subtitle">
          {paymentStatus === 'PENDING' &&
            `Complete the USSD prompt on your ${provider === 'MTN_MOMO' ? 'MTN' : 'Airtel'} phone`}
          {paymentStatus === 'PROCESSING' && 'Your payment is being processed...'}
          {paymentStatus === 'COMPLETED' &&
            `${currency} ${amount.toLocaleString()} has been paid successfully`}
          {paymentStatus === 'FAILED' && 'Please try again or contact support'}
        </p>

        {paymentStatus === 'PENDING' || paymentStatus === 'PROCESSING' ? (
          <div className="loading-spinner">
            <div className="spinner"></div>
          </div>
        ) : null}

        {transactionId && (
          <div className="transaction-info">
            <p className="info-label">Transaction ID:</p>
            <p className="info-value">{transactionId}</p>
          </div>
        )}

        {error && (
          <div className="error-message">
            <AlertCircle />
            {error}
          </div>
        )}

        {(paymentStatus === 'COMPLETED' || paymentStatus === 'FAILED') && (
          <div className="button-group mt-6">
            <button
              onClick={() => {
                if (paymentStatus === 'FAILED') {
                  setStep('provider');
                  setPhoneNumber('');
                  setProvider('');
                  setError(null);
                } else if (onPaymentCancel) {
                  onPaymentCancel();
                }
              }}
              className="btn-primary"
            >
              {paymentStatus === 'FAILED' ? 'Try Again' : 'Done'}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="mobile-money-payment">
      {step === 'provider' && renderProviderStep()}
      {step === 'phone' && renderPhoneStep()}
      {(step === 'processing' || step === 'complete') && renderProcessingStep()}
    </div>
  );
};

export default MobileMoneyPayment;
