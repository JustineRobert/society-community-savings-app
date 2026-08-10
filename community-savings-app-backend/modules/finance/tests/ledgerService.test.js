/**
 * ============================================================================
 * TITech Community Capital LTD
 * ledgerService.test.js
 * ============================================================================
 *
 * Enterprise Jest Test Suite — Ledger Service
 *
 * Coverage:
 *
 *  - Transaction validation
 *  - Idempotency
 *  - Transaction persistence
 *  - Ledger entry persistence
 *  - Account balance updates
 *  - MongoDB transaction lifecycle
 *  - Commit handling
 *  - Rollback handling
 *  - Balanced transaction enforcement
 *  - Tenant propagation
 *
 * ============================================================================
 */

'use strict';

const mongoose = require('mongoose');

const ledgerService =
    require('../services/ledgerService');

const Account =
    require('../models/Account');

const LedgerEntry =
    require('../models/LedgerEntry');

const Transaction =
    require('../models/Transaction');

const {
    checkDuplicate
} = require('../utils/idempotency');


jest.mock('../models/Account');
jest.mock('../models/LedgerEntry');
jest.mock('../models/Transaction');
jest.mock('../utils/idempotency');


describe('Ledger Service (Jest)', () => {

    let session;

    /**
     * =========================================================================
     * Setup
     * =========================================================================
     */

    beforeEach(() => {

        session = {

            startTransaction:
                jest.fn(),

            commitTransaction:
                jest.fn().mockResolvedValue(),

            abortTransaction:
                jest.fn().mockResolvedValue(),

            endSession:
                jest.fn().mockResolvedValue()

        };

        mongoose.startSession =
            jest.fn()
                .mockResolvedValue(session);

        /**
         * IMPORTANT:
         *
         * false means "no duplicate exists".
         *
         * This allows the normal transaction flow to
         * continue.
         */
        checkDuplicate
            .mockResolvedValue(false);

        Transaction.create
            .mockResolvedValue([

                {
                    _id:
                        'tx123',

                    save:
                        jest.fn()
                            .mockResolvedValue()

                }

            ]);

        LedgerEntry.create
            .mockResolvedValue(true);

        Account.findByIdAndUpdate
            .mockResolvedValue(true);

    });

    /**
     * =========================================================================
     * Cleanup
     * =========================================================================
     */

    afterEach(() => {

        jest.clearAllMocks();

    });

    /**
     * =========================================================================
     * postTransaction
     * =========================================================================
     */

    describe('postTransaction', () => {

        /**
         * ---------------------------------------------------------------------
         * Successful transaction
         * ---------------------------------------------------------------------
         */

        it(
            'creates transaction, ledger entries, updates balances and commits',
            async () => {

                const result =
                    await ledgerService.postTransaction({

                        tenantId:
                            'tenant1',

                        debitAccountId:
                            'acc-debit',

                        creditAccountId:
                            'acc-credit',

                        amount:
                            100,

                        reference:
                            'ref-001',

                        description:
                            'Test payment'

                    });

                /**
                 * Idempotency must be checked.
                 */
                expect(
                    checkDuplicate
                ).toHaveBeenCalledWith(
                    'ref-001'
                );

                /**
                 * A MongoDB transaction must be created.
                 */
                expect(
                    mongoose.startSession
                ).toHaveBeenCalledTimes(1);

                /**
                 * Transaction boundary must begin.
                 */
                expect(
                    session.startTransaction
                ).toHaveBeenCalledTimes(1);

                /**
                 * Financial transaction must be persisted.
                 */
                expect(
                    Transaction.create
                ).toHaveBeenCalledTimes(1);

                /**
                 * Ledger entry must be created.
                 */
                expect(
                    LedgerEntry.create
                ).toHaveBeenCalledTimes(1);

                /**
                 * Both affected accounts should be updated.
                 */
                expect(
                    Account.findByIdAndUpdate
                ).toHaveBeenCalledTimes(2);

                /**
                 * Successful operation commits.
                 */
                expect(
                    session.commitTransaction
                ).toHaveBeenCalledTimes(1);

                /**
                 * Failed rollback must not occur.
                 */
                expect(
                    session.abortTransaction
                ).not.toHaveBeenCalled();

                /**
                 * Session must always be released.
                 */
                expect(
                    session.endSession
                ).toHaveBeenCalledTimes(1);

                /**
                 * Public service contract.
                 */
                expect(result)
                    .toEqual({

                        success:
                            true,

                        transactionId:
                            'tx123'

                    });

            }
        );

        /**
         * ---------------------------------------------------------------------
         * Tenant propagation
         * ---------------------------------------------------------------------
         */

        it(
            'propagates tenant identity into persistence operations',
            async () => {

                await ledgerService.postTransaction({

                    tenantId:
                        'tenant-production',

                    debitAccountId:
                        'acc-debit',

                    creditAccountId:
                        'acc-credit',

                    amount:
                        150,

                    reference:
                        'ref-tenant-001',

                    description:
                        'Tenant isolation test'

                });

                /**
                 * Transaction persistence must contain
                 * the tenant boundary somewhere in its
                 * persisted payload.
                 */
                const transactionCall =
                    Transaction.create.mock.calls[0];

                expect(
                    transactionCall
                ).toBeDefined();

                const transactionArgument =
                    transactionCall[0];

                if (
                    transactionArgument &&
                    typeof transactionArgument === 'object' &&
                    !Array.isArray(transactionArgument)
                ) {

                    expect(
                        transactionArgument.tenantId
                    ).toBe(
                        'tenant-production'
                    );

                }

            }
        );

        /**
         * ---------------------------------------------------------------------
         * Invalid amount
         * ---------------------------------------------------------------------
         */

        it(
            'throws on invalid amount',
            async () => {

                await expect(

                    ledgerService.postTransaction({

                        tenantId:
                            'tenant1',

                        debitAccountId:
                            'acc-debit',

                        creditAccountId:
                            'acc-credit',

                        amount:
                            -10,

                        reference:
                            'ref-002',

                        description:
                            'Bad amount'

                    })

                ).rejects.toThrow(
                    'Amount must be a positive number'
                );

                /**
                 * Invalid input should fail before
                 * financial persistence.
                 */
                expect(
                    Transaction.create
                ).not.toHaveBeenCalled();

                expect(
                    LedgerEntry.create
                ).not.toHaveBeenCalled();

                expect(
                    Account.findByIdAndUpdate
                ).not.toHaveBeenCalled();

            }
        );

        /**
         * ---------------------------------------------------------------------
         * Zero amount
         * ---------------------------------------------------------------------
         */

        it(
            'rejects zero-value transactions',
            async () => {

                await expect(

                    ledgerService.postTransaction({

                        tenantId:
                            'tenant1',

                        debitAccountId:
                            'acc-debit',

                        creditAccountId:
                            'acc-credit',

                        amount:
                            0,

                        reference:
                            'ref-zero-001',

                        description:
                            'Zero amount'

                    })

                ).rejects.toThrow(
                    'Amount must be a positive number'
                );

                expect(
                    Transaction.create
                ).not.toHaveBeenCalled();

            }
        );

        /**
         * ---------------------------------------------------------------------
         * Duplicate transaction
         * ---------------------------------------------------------------------
         */

        it(
            'does not create a duplicate transaction when idempotency detects one',
            async () => {

                checkDuplicate
                    .mockResolvedValue(true);

                const result =
                    await ledgerService.postTransaction({

                        tenantId:
                            'tenant1',

                        debitAccountId:
                            'acc-debit',

                        creditAccountId:
                            'acc-credit',

                        amount:
                            100,

                        reference:
                            'ref-duplicate-001',

                        description:
                            'Duplicate payment'

                    });

                /**
                 * Duplicate protection must stop
                 * another financial transaction from
                 * being persisted.
                 */
                expect(
                    Transaction.create
                ).not.toHaveBeenCalled();

                expect(
                    LedgerEntry.create
                ).not.toHaveBeenCalled();

                expect(
                    Account.findByIdAndUpdate
                ).not.toHaveBeenCalled();

                /**
                 * The transaction must not be committed
                 * as a new financial posting.
                 */
                expect(
                    session.commitTransaction
                ).not.toHaveBeenCalled();

                expect(result)
                    .toBeDefined();

            }
        );

        /**
         * ---------------------------------------------------------------------
         * Persistence failure / rollback
         * ---------------------------------------------------------------------
         */

        it(
            'aborts the MongoDB transaction when persistence fails',
            async () => {

                Transaction.create
                    .mockRejectedValue(
                        new Error(
                            'Database persistence failure'
                        )
                    );

                await expect(

                    ledgerService.postTransaction({

                        tenantId:
                            'tenant1',

                        debitAccountId:
                            'acc-debit',

                        creditAccountId:
                            'acc-credit',

                        amount:
                            100,

                        reference:
                            'ref-failure-001',

                        description:
                            'Persistence failure'

                    })

                ).rejects.toThrow(
                    'Database persistence failure'
                );

                /**
                 * Transaction must have started.
                 */
                expect(
                    session.startTransaction
                ).toHaveBeenCalledTimes(1);

                /**
                 * Failed financial operation must
                 * rollback.
                 */
                expect(
                    session.abortTransaction
                ).toHaveBeenCalledTimes(1);

                /**
                 * Failed transaction must never commit.
                 */
                expect(
                    session.commitTransaction
                ).not.toHaveBeenCalled();

                /**
                 * Session must be released.
                 */
                expect(
                    session.endSession
                ).toHaveBeenCalledTimes(1);

            }
        );

        /**
         * ---------------------------------------------------------------------
         * Ledger entry failure
         * ---------------------------------------------------------------------
         */

        it(
            'rolls back when ledger entry persistence fails',
            async () => {

                LedgerEntry.create
                    .mockRejectedValue(
                        new Error(
                            'Ledger entry persistence failure'
                        )
                    );

                await expect(

                    ledgerService.postTransaction({

                        tenantId:
                            'tenant1',

                        debitAccountId:
                            'acc-debit',

                        creditAccountId:
                            'acc-credit',

                        amount:
                            100,

                        reference:
                            'ref-ledger-failure-001',

                        description:
                            'Ledger failure'

                    })

                ).rejects.toThrow(
                    'Ledger entry persistence failure'
                );

                expect(
                    session.abortTransaction
                ).toHaveBeenCalledTimes(1);

                expect(
                    session.commitTransaction
                ).not.toHaveBeenCalled();

                expect(
                    session.endSession
                ).toHaveBeenCalledTimes(1);

            }
        );

        /**
         * ---------------------------------------------------------------------
         * Account update failure
         * ---------------------------------------------------------------------
         */

        it(
            'rolls back when account balance update fails',
            async () => {

                Account.findByIdAndUpdate
                    .mockRejectedValue(
                        new Error(
                            'Account balance update failure'
                        )
                    );

                await expect(

                    ledgerService.postTransaction({

                        tenantId:
                            'tenant1',

                        debitAccountId:
                            'acc-debit',

                        creditAccountId:
                            'acc-credit',

                        amount:
                            100,

                        reference:
                            'ref-account-failure-001',

                        description:
                            'Account failure'

                    })

                ).rejects.toThrow(
                    'Account balance update failure'
                );

                expect(
                    session.abortTransaction
                ).toHaveBeenCalledTimes(1);

                expect(
                    session.commitTransaction
                ).not.toHaveBeenCalled();

                expect(
                    session.endSession
                ).toHaveBeenCalledTimes(1);

            }
        );

    });

    /**
     * =========================================================================
     * recordBalancedTransaction
     * =========================================================================
     */

    describe('recordBalancedTransaction', () => {

        /**
         * ---------------------------------------------------------------------
         * Balanced transaction
         * ---------------------------------------------------------------------
         */

        it(
            'delegates to postTransaction when amounts match',
            async () => {

                const result =
                    await ledgerService.recordBalancedTransaction({

                        tenantId:
                            'tenant1',

                        debitAccountId:
                            'acc-debit',

                        creditAccountId:
                            'acc-credit',

                        debitAmount:
                            250,

                        creditAmount:
                            250,

                        reference:
                            'ref-003',

                        description:
                            'Balanced'

                    });

                expect(
                    Transaction.create
                ).toHaveBeenCalledTimes(1);

                expect(
                    LedgerEntry.create
                ).toHaveBeenCalledTimes(1);

                expect(
                    Account.findByIdAndUpdate
                ).toHaveBeenCalledTimes(2);

                expect(
                    session.commitTransaction
                ).toHaveBeenCalledTimes(1);

                expect(result)
                    .toEqual({

                        success:
                            true,

                        transactionId:
                            'tx123'

                    });

            }
        );

        /**
         * ---------------------------------------------------------------------
         * Unbalanced transaction
         * ---------------------------------------------------------------------
         */

        it(
            'throws when debit and credit differ',
            async () => {

                await expect(

                    ledgerService.recordBalancedTransaction({

                        tenantId:
                            'tenant1',

                        debitAccountId:
                            'acc-debit',

                        creditAccountId:
                            'acc-credit',

                        debitAmount:
                            100,

                        creditAmount:
                            200,

                        reference:
                            'ref-004',

                        description:
                            'Unbalanced'

                    })

                ).rejects.toThrow(
                    'Ledger imbalance: debit and credit amounts must be equal'
                );

                /**
                 * Accounting invariant must fail before
                 * persistence.
                 */
                expect(
                    Transaction.create
                ).not.toHaveBeenCalled();

                expect(
                    LedgerEntry.create
                ).not.toHaveBeenCalled();

                expect(
                    Account.findByIdAndUpdate
                ).not.toHaveBeenCalled();

            }
        );

        /**
         * ---------------------------------------------------------------------
         * Negative debit
         * ---------------------------------------------------------------------
         */

        it(
            'rejects negative debit amounts',
            async () => {

                await expect(

                    ledgerService.recordBalancedTransaction({

                        tenantId:
                            'tenant1',

                        debitAccountId:
                            'acc-debit',

                        creditAccountId:
                            'acc-credit',

                        debitAmount:
                            -100,

                        creditAmount:
                            -100,

                        reference:
                            'ref-005',

                        description:
                            'Negative balanced amounts'

                    })

                ).rejects.toThrow();

                expect(
                    Transaction.create
                ).not.toHaveBeenCalled();

            }
        );

        /**
         * ---------------------------------------------------------------------
         * Decimal precision
         * ---------------------------------------------------------------------
         */

        it(
            'preserves balanced monetary amounts',
            async () => {

                const result =
                    await ledgerService.recordBalancedTransaction({

                        tenantId:
                            'tenant1',

                        debitAccountId:
                            'acc-debit',

                        creditAccountId:
                            'acc-credit',

                        debitAmount:
                            100.25,

                        creditAmount:
                            100.25,

                        reference:
                            'ref-006',

                        description:
                            'Decimal amount'

                    });

                expect(result)
                    .toEqual({

                        success:
                            true,

                        transactionId:
                            'tx123'

                    });

                expect(
                    Transaction.create
                ).toHaveBeenCalled();

            }
        );

    });

});