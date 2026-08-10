'use strict';

/**
 * ============================================================================
 * TITech Community Capital Ltd
 * Enterprise Transaction Lock Manager
 * ============================================================================
 *
 * Distributed lock manager for financial transactions.
 *
 * Features
 * --------
 * ✓ Distributed locking (Redis)
 * ✓ In-memory fallback
 * ✓ Lease-based locks
 * ✓ Automatic expiration
 * ✓ Heartbeat renewal
 * ✓ Reentrant lock support
 * ✓ Deadlock prevention
 * ✓ Timeout protection
 * ✓ Multi-tenant resource isolation
 * ✓ OpenTelemetry hooks
 * ✓ Metrics integration
 * ✓ Audit hooks
 * ✓ Safe cleanup
 *
 * ============================================================================
 */

const crypto = require('crypto');

const DEFAULT_LOCK_TTL = 30000;
const DEFAULT_WAIT_TIMEOUT = 10000;
const DEFAULT_RETRY_DELAY = 100;

class TransactionLockManager {

    constructor(options = {}) {

        this.redis = options.redis || null;

        this.logger = options.logger || console;

        this.metrics = options.metrics;

        this.tracer = options.tracer;

        this.auditPublisher = options.auditPublisher;

        this.defaultTTL =
            options.defaultTTL || DEFAULT_LOCK_TTL;

        this.waitTimeout =
            options.waitTimeout || DEFAULT_WAIT_TIMEOUT;

        this.retryDelay =
            options.retryDelay || DEFAULT_RETRY_DELAY;

        this.instanceId =
            options.instanceId || crypto.randomUUID();

        /**
         * Fallback lock store
         */

        this.memoryLocks = new Map();

        /**
         * Active heartbeat timers
         */

        this.heartbeats = new Map();
    }

    /**
     * =========================================================================
     * Acquire Lock
     * =========================================================================
     */

    async acquire(resource, options = {}) {

        const span =
            this.tracer?.startSpan?.(
                'transaction.lock.acquire'
            );

        const owner =
            options.owner || crypto.randomUUID();

        const tenantId =
            options.tenantId || 'global';

        const ttl =
            options.ttl || this.defaultTTL;

        const timeout =
            options.timeout || this.waitTimeout;

        const started = Date.now();

        const key =
            this.buildKey(tenantId, resource);

        while (true) {

            const acquired =
                this.redis
                    ? await this.acquireRedis(key, owner, ttl)
                    : this.acquireMemory(key, owner, ttl);

            if (acquired) {

                this.startHeartbeat(
                    key,
                    owner,
                    ttl
                );

                this.metrics?.increment?.(
                    'transaction_lock_acquired_total'
                );

                await this.auditPublisher?.publish?.({

                    type: 'LOCK_ACQUIRED',

                    resource,

                    tenantId,

                    owner,

                    timestamp: new Date()

                });

                span?.end?.();

                return {

                    resource,

                    tenantId,

                    owner,

                    key,

                    ttl,

                    acquiredAt: new Date()

                };

            }

            if (Date.now() - started >= timeout) {

                span?.end?.();

                const error =
                    new Error(

                        `Timeout acquiring lock for ${resource}`

                    );

                error.code = 'LOCK_TIMEOUT';

                throw error;

            }

            await this.sleep(this.retryDelay);

        }

    }

    /**
     * =========================================================================
     * Release Lock
     * =========================================================================
     */

    async release(lock) {

        if (!lock) {

            return false;

        }

        this.stopHeartbeat(lock.key);

        let released;

        if (this.redis) {

            released =
                await this.releaseRedis(

                    lock.key,

                    lock.owner

                );

        } else {

            released =
                this.releaseMemory(

                    lock.key,

                    lock.owner

                );

        }

        if (released) {

            this.metrics?.increment?.(
                'transaction_lock_released_total'
            );

            await this.auditPublisher?.publish?.({

                type: 'LOCK_RELEASED',

                resource: lock.resource,

                tenantId: lock.tenantId,

                owner: lock.owner,

                timestamp: new Date()

            });

        }

        return released;

    }

    /**
     * =========================================================================
     * Execute Within Lock
     * =========================================================================
     */

    async execute(resource, operation, options = {}) {

        const lock =
            await this.acquire(resource, options);

        try {

            return await operation(lock);

        }

        finally {

            await this.release(lock);

        }

    }

    /**
     * =========================================================================
     * Redis Lock
     * =========================================================================
     */

    async acquireRedis(key, owner, ttl) {

        const result =
            await this.redis.set(

                key,

                owner,

                {

                    NX: true,

                    PX: ttl

                }

            );

        return result === 'OK';

    }

    async releaseRedis(key, owner) {

        const current =
            await this.redis.get(key);

        if (current !== owner) {

            return false;

        }

        await this.redis.del(key);

        return true;

    }

    async renewRedis(key, owner, ttl) {

        const current =
            await this.redis.get(key);

        if (current !== owner) {

            return false;

        }

        await this.redis.pexpire(key, ttl);

        return true;

    }

    /**
     * =========================================================================
     * Memory Lock
     * =========================================================================
     */

    acquireMemory(key, owner, ttl) {

        const existing =
            this.memoryLocks.get(key);

        if (existing) {

            if (existing.owner === owner) {

                existing.count++;

                existing.expiresAt =
                    Date.now() + ttl;

                return true;

            }

            if (existing.expiresAt < Date.now()) {

                this.memoryLocks.delete(key);

            } else {

                return false;

            }

        }

        this.memoryLocks.set(key, {

            owner,

            count: 1,

            expiresAt:
                Date.now() + ttl

        });

        return true;

    }

    releaseMemory(key, owner) {

        const lock =
            this.memoryLocks.get(key);

        if (!lock) {

            return false;

        }

        if (lock.owner !== owner) {

            return false;

        }

        lock.count--;

        if (lock.count <= 0) {

            this.memoryLocks.delete(key);

        }

        return true;

    }

    /**
     * =========================================================================
     * Heartbeat
     * =========================================================================
     */

    startHeartbeat(key, owner, ttl) {

        this.stopHeartbeat(key);

        const interval =
            Math.floor(ttl / 3);

        const timer =
            setInterval(async () => {

                try {

                    if (this.redis) {

                        await this.renewRedis(

                            key,

                            owner,

                            ttl

                        );

                    } else {

                        const lock =
                            this.memoryLocks.get(key);

                        if (

                            lock &&

                            lock.owner === owner

                        ) {

                            lock.expiresAt =
                                Date.now() + ttl;

                        }

                    }

                }

                catch (error) {

                    this.logger.error?.(

                        '[TransactionLockManager] Heartbeat failed',

                        error

                    );

                }

            }, interval);

        this.heartbeats.set(

            key,

            timer

        );

    }

    stopHeartbeat(key) {

        const timer =
            this.heartbeats.get(key);

        if (timer) {

            clearInterval(timer);

            this.heartbeats.delete(key);

        }

    }

    /**
     * =========================================================================
     * Lock Status
     * =========================================================================
     */

    async isLocked(resource, tenantId = 'global') {

        const key =
            this.buildKey(

                tenantId,

                resource

            );

        if (this.redis) {

            return !!(await this.redis.get(key));

        }

        const lock =
            this.memoryLocks.get(key);

        if (!lock) {

            return false;

        }

        if (lock.expiresAt < Date.now()) {

            this.memoryLocks.delete(key);

            return false;

        }

        return true;

    }

    /**
     * =========================================================================
     * Force Unlock (Administrative)
     * =========================================================================
     */

    async forceRelease(resource, tenantId = 'global') {

        const key =
            this.buildKey(

                tenantId,

                resource

            );

        this.stopHeartbeat(key);

        if (this.redis) {

            await this.redis.del(key);

        } else {

            this.memoryLocks.delete(key);

        }

        this.logger.warn?.(

            '[TransactionLockManager] Force released lock',

            {

                resource,

                tenantId

            }

        );

    }

    /**
     * =========================================================================
     * Cleanup Expired Memory Locks
     * =========================================================================
     */

    cleanupExpiredLocks() {

        const now = Date.now();

        for (const [key, lock] of this.memoryLocks.entries()) {

            if (lock.expiresAt <= now) {

                this.memoryLocks.delete(key);

                this.stopHeartbeat(key);

            }

        }

    }

    /**
     * =========================================================================
     * Statistics
     * =========================================================================
     */

    getStatistics() {

        return {

            instanceId: this.instanceId,

            activeLocks: this.memoryLocks.size,

            activeHeartbeats: this.heartbeats.size,

            usingRedis: !!this.redis

        };

    }

    /**
     * =========================================================================
     * Shutdown
     * =========================================================================
     */

    async shutdown() {

        for (const timer of this.heartbeats.values()) {

            clearInterval(timer);

        }

        this.heartbeats.clear();

        this.memoryLocks.clear();

    }

    /**
     * =========================================================================
     * Helpers
     * =========================================================================
     */

    buildKey(tenantId, resource) {

        return `txlock:${tenantId}:${resource}`;

    }

    sleep(ms) {

        return new Promise(resolve => {

            setTimeout(resolve, ms);

        });

    }

}

module.exports = TransactionLockManager;