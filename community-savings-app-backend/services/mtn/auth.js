// backend/services/mtn/auth.js
/**
 * ============================================================================
 * MTN MOMO AUTH SERVICE
 * ============================================================================
 * TITech Community Capital
 *
 * Responsibilities:
 *  - OAuth Authentication
 *  - Token Refresh
 *  - Token Caching
 *  - Expiry Management
 *  - Retry Handling
 *  - Health Monitoring
 *  - Singleton Access Token Manager
 *
 * Environment Variables:
 *
 * MTN_MOMO_BASE_URL=
 * MTN_MOMO_API_USER=
 * MTN_MOMO_API_KEY=
 * MTN_MOMO_SUBSCRIPTION_KEY=
 *
 * ============================================================================
 */

const axios = require("axios");

let logger;

try {
  logger = require("../../modules/logger");
} catch {
  logger = console;
}

class MTNAuthService {
  constructor() {
    this.baseUrl =
      process.env.MTN_MOMO_BASE_URL;

    this.apiUser =
      process.env.MTN_MOMO_API_USER;

    this.apiKey =
      process.env.MTN_MOMO_API_KEY;

    this.subscriptionKey =
      process.env.MTN_MOMO_SUBSCRIPTION_KEY;

    /**
     * Cached token
     */
    this.accessToken = null;

    /**
     * Epoch timestamp
     */
    this.expiresAt = null;

    /**
     * Prevent concurrent refresh storms
     */
    this.refreshPromise = null;

    /**
     * Refresh 60 seconds early
     */
    this.expiryBufferMs = 60 * 1000;

    /**
     * HTTP timeout
     */
    this.timeout = 30000;
  }

  /**
   * ==========================================================================
   * TOKEN STATUS
   * ==========================================================================
   */

  isTokenValid() {
    if (!this.accessToken) {
      return false;
    }

    if (!this.expiresAt) {
      return false;
    }

    return (
      Date.now() <
      (this.expiresAt - this.expiryBufferMs)
    );
  }

  getRemainingLifetime() {
    if (!this.expiresAt) {
      return 0;
    }

    return Math.max(
      0,
      this.expiresAt - Date.now()
    );
  }

  /**
   * ==========================================================================
   * AUTHENTICATE
   * ==========================================================================
   */

  async authenticate(forceRefresh = false) {
    try {
      if (
        !forceRefresh &&
        this.isTokenValid()
      ) {
        return {
          success: true,
          accessToken: this.accessToken,
          cached: true,
          expiresAt: this.expiresAt,
        };
      }

      if (this.refreshPromise) {
        return this.refreshPromise;
      }

      this.refreshPromise =
        this.requestNewToken();

      const result =
        await this.refreshPromise;

      return result;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * ==========================================================================
   * TOKEN REQUEST
   * ==========================================================================
   */

  async requestNewToken() {
    const credentials = Buffer.from(
      `${this.apiUser}:${this.apiKey}`
    ).toString("base64");

    try {
      logger.info(
        "[MTN AUTH] Requesting OAuth token"
      );

      const response = await axios.post(
        `${this.baseUrl}/collection/token/`,
        {},
        {
          timeout: this.timeout,
          headers: {
            Authorization: `Basic ${credentials}`,
            "Ocp-Apim-Subscription-Key":
              this.subscriptionKey,
          },
        }
      );

      const accessToken =
        response.data.access_token;

      const expiresIn =
        Number(
          response.data.expires_in || 3600
        ) * 1000;

      this.accessToken = accessToken;

      this.expiresAt =
        Date.now() + expiresIn;

      logger.info(
        "[MTN AUTH] Token acquired successfully"
      );

      return {
        success: true,
        accessToken,
        expiresAt: this.expiresAt,
        cached: false,
      };
    } catch (error) {
      logger.error(
        "[MTN AUTH] Authentication failed",
        error.response?.data || error.message
      );

      throw new Error(
        error.response?.data?.message ||
        error.message ||
        "MTN authentication failed"
      );
    }
  }

  /**
   * ==========================================================================
   * REFRESH TOKEN
   * ==========================================================================
   */

  async refreshToken() {
    logger.info(
      "[MTN AUTH] Refreshing access token"
    );

    return this.authenticate(true);
  }

  /**
   * ==========================================================================
   * GET RAW ACCESS TOKEN
   * ==========================================================================
   */

  async getAccessToken() {
    const result =
      await this.authenticate();

    return result.accessToken;
  }

  /**
   * ==========================================================================
   * AUTHORIZATION HEADER
   * ==========================================================================
   */

  async getAuthorizationHeader() {
    const token =
      await this.getAccessToken();

    return {
      Authorization: `Bearer ${token}`,
    };
  }

  /**
   * ==========================================================================
   * CLEAR CACHE
   * ==========================================================================
   */

  clearCache() {
    this.accessToken = null;
    this.expiresAt = null;

    logger.info(
      "[MTN AUTH] Token cache cleared"
    );
  }

  /**
   * ==========================================================================
   * HEALTH CHECK
   * ==========================================================================
   */

  async healthCheck() {
    try {
      const authenticated =
        await this.authenticate();

      return {
        provider: "MTN_MOMO",
        healthy: true,
        authenticated: !!authenticated,
        tokenCached:
          this.isTokenValid(),
        expiresAt: this.expiresAt,
        remainingLifetime:
          this.getRemainingLifetime(),
        timestamp:
          new Date().toISOString(),
      };
    } catch (error) {
      return {
        provider: "MTN_MOMO",
        healthy: false,
        error: error.message,
        timestamp:
          new Date().toISOString(),
      };
    }
  }

  /**
   * ==========================================================================
   * METRICS
   * ==========================================================================
   */

  getMetrics() {
    return {
      provider: "MTN_MOMO",
      tokenCached:
        !!this.accessToken,
      tokenValid:
        this.isTokenValid(),
      expiresAt:
        this.expiresAt,
      remainingLifetime:
        this.getRemainingLifetime(),
      timestamp:
        new Date().toISOString(),
    };
  }
}

/**
 * ============================================================================
 * SINGLETON INSTANCE
 * ============================================================================
 */

module.exports = new MTNAuthService();