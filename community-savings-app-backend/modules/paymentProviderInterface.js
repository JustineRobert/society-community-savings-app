// backend/modules/paymentProviderInterface.js
/**
 * ============================================================================
 * Payment Provider Interface
 * ============================================================================
 * TITech Community Capital
 *
 * Abstract contract for all payment providers:
 *
 * Supported Providers:
 *  - MTN Mobile Money
 *  - Airtel Money
 *  - Flutterwave
 *  - Pesapal
 *  - Stripe
 *  - Bank APIs
 *  - Future integrations
 *
 * Every provider implementation MUST extend this class.
 * ============================================================================
 */

class PaymentProviderInterface {
  constructor(config = {}) {
    if (new.target === PaymentProviderInterface) {
      throw new Error(
        "PaymentProviderInterface is abstract and cannot be instantiated directly"
      );
    }

    this.config = config;
    this.providerName = config.providerName || "UNKNOWN_PROVIDER";
  }

  /**
   * ==========================================================================
   * AUTHENTICATION
   * ==========================================================================
   */

  async authenticate() {
    throw new Error(
      `${this.providerName}: authenticate() must be implemented`
    );
  }

  async refreshToken() {
    throw new Error(
      `${this.providerName}: refreshToken() must be implemented`
    );
  }

  /**
   * ==========================================================================
   * COLLECTIONS
   * ==========================================================================
   */

  /**
   * Initiate customer payment collection
   *
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async collect(payload) {
    throw new Error(
      `${this.providerName}: collect() must be implemented`
    );
  }

  /**
   * Reverse collection transaction
   *
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async reverseCollection(payload) {
    throw new Error(
      `${this.providerName}: reverseCollection() must be implemented`
    );
  }

  /**
   * ==========================================================================
   * DISBURSEMENTS
   * ==========================================================================
   */

  /**
   * Send money to customer
   *
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async disburse(payload) {
    throw new Error(
      `${this.providerName}: disburse() must be implemented`
    );
  }

  /**
   * Reverse payout
   *
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async reverseDisbursement(payload) {
    throw new Error(
      `${this.providerName}: reverseDisbursement() must be implemented`
    );
  }

  /**
   * ==========================================================================
   * TRANSACTION MANAGEMENT
   * ==========================================================================
   */

  /**
   * Get transaction status
   *
   * @param {string} reference
   * @returns {Promise<Object>}
   */
  async getTransactionStatus(reference) {
    throw new Error(
      `${this.providerName}: getTransactionStatus() must be implemented`
    );
  }

  /**
   * Get transaction details
   *
   * @param {string} reference
   * @returns {Promise<Object>}
   */
  async getTransaction(reference) {
    throw new Error(
      `${this.providerName}: getTransaction() must be implemented`
    );
  }

  /**
   * Retry failed transaction
   *
   * @param {string} reference
   * @returns {Promise<Object>}
   */
  async retryTransaction(reference) {
    throw new Error(
      `${this.providerName}: retryTransaction() must be implemented`
    );
  }

  /**
   * Cancel pending transaction
   *
   * @param {string} reference
   * @returns {Promise<Object>}
   */
  async cancelTransaction(reference) {
    throw new Error(
      `${this.providerName}: cancelTransaction() must be implemented`
    );
  }

  /**
   * ==========================================================================
   * ACCOUNT INFORMATION
   * ==========================================================================
   */

  /**
   * Provider wallet/account balance
   *
   * @returns {Promise<Object>}
   */
  async getBalance() {
    throw new Error(
      `${this.providerName}: getBalance() must be implemented`
    );
  }

  /**
   * Settlement account balance
   *
   * @returns {Promise<Object>}
   */
  async getSettlementBalance() {
    throw new Error(
      `${this.providerName}: getSettlementBalance() must be implemented`
    );
  }

  /**
   * ==========================================================================
   * WEBHOOKS
   * ==========================================================================
   */

  /**
   * Verify provider webhook signature
   *
   * @param {Object} headers
   * @param {String|Object} payload
   * @returns {Promise<boolean>}
   */
  async verifyWebhook(headers, payload) {
    throw new Error(
      `${this.providerName}: verifyWebhook() must be implemented`
    );
  }

  /**
   * Process provider webhook
   *
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async handleWebhook(payload) {
    throw new Error(
      `${this.providerName}: handleWebhook() must be implemented`
    );
  }

  /**
   * ==========================================================================
   * RECONCILIATION
   * ==========================================================================
   */

  /**
   * Fetch reconciliation report
   *
   * @param {Date|string} date
   * @returns {Promise<Object>}
   */
  async reconcile(date) {
    throw new Error(
      `${this.providerName}: reconcile() must be implemented`
    );
  }

  /**
   * Settlement report
   *
   * @param {Date|string} date
   * @returns {Promise<Object>}
   */
  async getSettlementReport(date) {
    throw new Error(
      `${this.providerName}: getSettlementReport() must be implemented`
    );
  }

  /**
   * ==========================================================================
   * HEALTH & MONITORING
   * ==========================================================================
   */

  /**
   * Provider connectivity test
   *
   * @returns {Promise<Object>}
   */
  async healthCheck() {
    throw new Error(
      `${this.providerName}: healthCheck() must be implemented`
    );
  }

  /**
   * Get provider status
   *
   * @returns {Promise<Object>}
   */
  async getProviderStatus() {
    throw new Error(
      `${this.providerName}: getProviderStatus() must be implemented`
    );
  }

  /**
   * ==========================================================================
   * PROVIDER CAPABILITIES
   * ==========================================================================
   */

  /**
   * Returns supported features.
   */
  getCapabilities() {
    return {
      collections: false,
      disbursements: false,
      reversals: false,
      reconciliation: false,
      settlements: false,
      balanceInquiry: false,
      webhookVerification: false,
      transactionLookup: false,
      transactionRetry: false,
      cancellation: false,
    };
  }

  /**
   * ==========================================================================
   * UTILITIES
   * ==========================================================================
   */

  /**
   * Normalize provider response.
   *
   * @param {Object} response
   * @returns {Object}
   */
  normalizeResponse(response) {
    return response;
  }

  /**
   * Normalize provider errors.
   *
   * @param {Error} error
   * @returns {Object}
   */
  normalizeError(error) {
    return {
      success: false,
      provider: this.providerName,
      code: error.code || "PROVIDER_ERROR",
      message: error.message,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Standardized success response.
   *
   * @param {Object} data
   * @returns {Object}
   */
  success(data = {}) {
    return {
      success: true,
      provider: this.providerName,
      timestamp: new Date().toISOString(),
      ...data,
    };
  }

  /**
   * Standardized failure response.
   *
   * @param {String} message
   * @param {String} code
   * @returns {Object}
   */
  failure(message, code = "PROVIDER_ERROR") {
    return {
      success: false,
      provider: this.providerName,
      code,
      message,
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = PaymentProviderInterface;