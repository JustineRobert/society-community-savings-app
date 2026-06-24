// backend/services/airtel/auth.js
/**
 * ============================================================================
 * AIRTEL MONEY AUTH SERVICE
 * ============================================================================
 *
 * Responsibilities
 *  - OAuth Authentication
 *  - Token Refresh
 *  - Token Caching
 *  - Expiry Management
 *  - Retry Logic
 *  - Circuit Breaker
 *  - Health Monitoring
 *
 * ============================================================================
 */

const axios = require("axios");
const crypto = require("crypto");

let logger;
let redisClient;

try {
  logger = require("../../modules/logger");
} catch {
  logger = console;
}

try {
  redisClient = require("../../config/redis");
} catch {
  redisClient = null;
}

class AirtelAuthService {
  constructor() {
    this.provider = "AIRTEL_MONEY";

    this.baseUrl =
      process.env.AIRTEL_BASE_URL ||
      "https://openapi.airtel.africa";

    this.clientId =
      process.env.AIRTEL_CLIENT_ID;

    this.clientSecret =
      process.env.AIRTEL_CLIENT_SECRET;

    this.cacheKey =
      "airtel:oauth:token";

    this.memoryCache = {
      token: null,
      expiresAt: null,
    };

    this.metrics = {
      tokenRequests: 0,
      cacheHits: 0,
      refreshes: 0,
      failures: 0,
    };

    this.circuitBreaker = {
      failures: 0,
      threshold: 5,
      openedAt: null,
      timeout: 60000,
    };
  }

  /**
   * ==========================================================================
   * HEALTH
   * ==========================================================================
   */

  healthCheck() {
    return {
      provider: this.provider,
      service: "AUTH",
      healthy: true,
      circuitOpen:
        this.isCircuitOpen(),
      timestamp:
        new Date().toISOString(),
    };
  }

  getMetrics() {
    return {
      provider: this.provider,
      ...this.metrics,
      timestamp:
        new Date().toISOString(),
    };
  }

  /**
   * ==========================================================================
   * CIRCUIT BREAKER
   * ==========================================================================
   */

  isCircuitOpen() {
    if (
      !this.circuitBreaker.openedAt
    ) {
      return false;
    }

    const elapsed =
      Date.now() -
      this.circuitBreaker.openedAt;

    if (
      elapsed >
      this.circuitBreaker.timeout
    ) {
      this.circuitBreaker.failures = 0;
      this.circuitBreaker.openedAt =
        null;

      return false;
    }

    return true;
  }

  registerFailure() {
    this.circuitBreaker.failures++;

    if (
      this.circuitBreaker.failures >=
      this.circuitBreaker.threshold
    ) {
      this.circuitBreaker.openedAt =
        Date.now();

      logger.error(
        "[AIRTEL AUTH] Circuit breaker opened"
      );
    }
  }

  registerSuccess() {
    this.circuitBreaker.failures = 0;
    this.circuitBreaker.openedAt =
      null;
  }

  /**
   * ==========================================================================
   * CACHE HELPERS
   * ==========================================================================
   */

  async getCachedToken() {
    try {
      /**
       * Redis Cache
       */

      if (
        redisClient?.get
      ) {
        const token =
          await redisClient.get(
            this.cacheKey
          );

        if (token) {
          this.metrics.cacheHits++;

          return token;
        }
      }

      /**
       * Memory Cache
       */

      if (
        this.memoryCache.token &&
        this.memoryCache.expiresAt &&
        Date.now() <
          this.memoryCache.expiresAt
      ) {
        this.metrics.cacheHits++;

        return this.memoryCache.token;
      }

      return null;
    } catch (error) {
      logger.error(
        "[AIRTEL AUTH] Cache retrieval failed",
        error
      );

      return null;
    }
  }

  async cacheToken(
    token,
    expiresIn
  ) {
    try {
      const ttl =
        Math.max(
          Number(expiresIn) - 60,
          60
        );

      this.memoryCache.token =
        token;

      this.memoryCache.expiresAt =
        Date.now() +
        ttl * 1000;

      if (
        redisClient?.setEx
      ) {
        await redisClient.setEx(
          this.cacheKey,
          ttl,
          token
        );
      }

      return true;
    } catch (error) {
      logger.error(
        "[AIRTEL AUTH] Cache store failed",
        error
      );

      return false;
    }
  }

  async invalidateCache() {
    try {
      this.memoryCache = {
        token: null,
        expiresAt: null,
      };

      if (
        redisClient?.del
      ) {
        await redisClient.del(
          this.cacheKey
        );
      }
    } catch (error) {
      logger.error(
        "[AIRTEL AUTH] Cache invalidation failed",
        error
      );
    }
  }

  /**
   * ==========================================================================
   * TOKEN REQUEST
   * ==========================================================================
   */

  async requestToken() {
    if (
      this.isCircuitOpen()
    ) {
      throw new Error(
        "Authentication service temporarily unavailable"
      );
    }

    this.metrics.tokenRequests++;

    try {
      const response =
        await axios.post(
          `${this.baseUrl}/auth/oauth2/token`,
          {
            client_id:
              this.clientId,
            client_secret:
              this.clientSecret,
            grant_type:
              "client_credentials",
          },
          {
            headers: {
              Accept:
                "application/json",
              "Content-Type":
                "application/json",
              "X-Correlation-ID":
                crypto.randomUUID(),
            },
            timeout: 30000,
          }
        );

      const token =
        response.data?.access_token;

      const expiresIn =
        response.data?.expires_in ||
        3600;

      if (!token) {
        throw new Error(
          "No access token returned"
        );
      }

      await this.cacheToken(
        token,
        expiresIn
      );

      this.registerSuccess();

      logger.info(
        "[AIRTEL AUTH] Token acquired"
      );

      return token;
    } catch (error) {
      this.metrics.failures++;

      this.registerFailure();

      logger.error(
        "[AIRTEL AUTH] Token request failed",
        error.response?.data ||
          error.message
      );

      throw error;
    }
  }

  /**
   * ==========================================================================
   * PUBLIC API
   * ==========================================================================
   */

  async authenticate() {
    const cachedToken =
      await this.getCachedToken();

    if (cachedToken) {
      return cachedToken;
    }

    return this.requestToken();
  }

  async refreshToken() {
    this.metrics.refreshes++;

    await this.invalidateCache();

    return this.requestToken();
  }

  async getAuthorizationHeaders() {
    const token =
      await this.authenticate();

    return {
      Authorization: `Bearer ${token}`,
      Accept:
        "application/json",
      "Content-Type":
        "application/json",
      "X-Correlation-ID":
        crypto.randomUUID(),
    };
  }

  /**
   * ==========================================================================
   * VERIFY TOKEN
   * ==========================================================================
   */

  async verifyToken() {
    try {
      const token =
        await this.authenticate();

      return {
        valid: !!token,
        provider:
          this.provider,
        expiresAt:
          this.memoryCache
            .expiresAt,
      };
    } catch (error) {
      return {
        valid: false,
        error:
          error.message,
      };
    }
  }
}

module.exports =
  new AirtelAuthService();