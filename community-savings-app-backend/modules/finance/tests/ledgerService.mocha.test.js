/**
 * ============================================================================
 * TITech Community Capital LTD
 * ledgerService.mocha.test.js
 * ============================================================================
 *
 * Enterprise Mocha Tests — Ledger Service
 *
 * Coverage:
 *
 *  - Successful transaction posting
 *  - MongoDB transaction lifecycle
 *  - Idempotency protection
 *  - Transaction persistence
 *  - Ledger entry persistence
 *  - Account balance updates
 *  - Balanced transaction enforcement
 *
 * ============================================================================
 */

'use strict';

const sinon = require('sinon');
const { expect } = require('chai');
const mongoose = require('mongoose');

const ledgerService =
    require('../services/ledgerService');

const Account =
    require('../models/Account');

const LedgerEntry =
    require('../models/LedgerEntry');

const Transaction =
    require('../models/Transaction');

const idempotency =
    require('../utils/idempotency');


describe('Ledger Service (Mocha)', function () {

    let sandbox;
    let session;

    /**
     * =========================================================================
     * Setup
     * =========================================================================
     */

    beforeEach(function () {

        sandbox =
            sinon.createSandbox();

        session = {

            startTransaction:
                sandbox.stub(),

            commitTransaction:
                sandbox.stub().resolves(),

            abortTransaction:
                sandbox.stub().resolves(),

            endSession:
                sandbox.stub().resolves()

        };

        sandbox
            .stub(mongoose, 'startSession')
            .resolves(session);

        /**
         * The service should continue when no duplicate
         * is detected.
         *
         * If your idempotency implementation uses the
         * opposite boolean convention, change this stub
         * to match that contract.
         */
        sandbox
            .stub(idempotency, 'checkDuplicate')
            .resolves(false);

        /**
         * Mongoose create() commonly returns an array when
         * called with an array of documents.
         */
        sandbox
            .stub(Transaction, 'create')
            .resolves([
                {
                    _id: 'tx123',

                    save:
                        sandbox.stub().resolves()

                }
            ]);

        sandbox
            .stub(LedgerEntry, 'create')
            .resolves(true);

        sandbox
            .stub(Account, 'findByIdAndUpdate')
            .resolves(true);

    });

    /**
     * =========================================================================
     * Cleanup
     * =========================================================================
     */

    afterEach(function () {

        sandbox.restore();

    });

    /**
     * =========================================================================
     * Successful Transaction Posting
     * =========================================================================
     */

    it(
        'postTransaction should complete the full ledger flow',
        async function () {

            const result =
                await ledgerService.postTransaction({

                    tenantId:
                        'tenant1',

                    debitAccountId:
                        'acc1',

                    creditAccountId:
                        'acc2',

                    amount:
                        50,

                    reference:
                        'ref-mocha-1',

                    description:
                        'Mocha test'

                });

            expect(result)
                .to.deep.equal({

                    success:
                        true,

                    transactionId:
                        'tx123'

                });

            /**
             * MongoDB transaction must start.
             */
            expect(
                session.startTransaction.calledOnce
            ).to.equal(true);

            /**
             * Successful posting must commit.
             */
            expect(
                session.commitTransaction.calledOnce
            ).to.equal(true);

            /**
             * Session must always be released.
             */
            expect(
                session.endSession.calledOnce
            ).to.equal(true);

            /**
             * Successful transactions should not
             * trigger rollback.
             */
            expect(
                session.abortTransaction.called
            ).to.equal(false);

        }
    );

    /**
     * =========================================================================
     * Balanced Transaction Validation
     * =========================================================================
     */

    it(
        'recordBalancedTransaction should reject unbalanced amounts',
        async function () {

            try {

                await ledgerService.recordBalancedTransaction({

                    tenantId:
                        'tenant1',

                    debitAccountId:
                        'acc1',

                    creditAccountId:
                        'acc2',

                    debitAmount:
                        10,

                    creditAmount:
                        20,

                    reference:
                        'ref-mocha-2',

                    description:
                        'Unbalanced'

                });

                throw new Error(
                    'Expected error not thrown'
                );

            }
            catch (error) {

                expect(error.message)
                    .to.equal(
                        'Ledger imbalance: debit and credit amounts must be equal'
                    );

            }

        }
    );

    /**
     * =========================================================================
     * Idempotency Protection
     * =========================================================================
     */

    it(
        'postTransaction should not create a duplicate transaction',
        async function () {

            idempotency
                .checkDuplicate
                .resolves(true);

            const transactionCreate =
                Transaction.create;

            const result =
                await ledgerService.postTransaction({

                    tenantId:
                        'tenant1',

                    debitAccountId:
                        'acc1',

                    creditAccountId:
                        'acc2',

                    amount:
                        50,

                    reference:
                        'ref-mocha-duplicate',

                    description:
                        'Duplicate test'

                });

            /**
             * The exact return contract depends on the
             * current idempotency implementation.
             *
             * At minimum, persistence must not occur
             * again when the service treats true as
             * duplicate.
             */
            expect(
                transactionCreate.called
            ).to.equal(false);

            expect(
                session.commitTransaction.called
            ).to.equal(false);

            expect(
                session.endSession.calledOnce
            ).to.equal(true);

            expect(result)
                .to.exist;

        }
    );

    /**
     * =========================================================================
     * Ledger Persistence
     * =========================================================================
     */

    it(
        'postTransaction should persist transaction and ledger entry',
        async function () {

            await ledgerService.postTransaction({

                tenantId:
                    'tenant1',

                debitAccountId:
                    'acc1',

                creditAccountId:
                    'acc2',

                amount:
                    100,

                reference:
                    'ref-mocha-persistence',

                description:
                    'Persistence test'

            });

            expect(
                Transaction.create.calledOnce
            ).to.equal(true);

            expect(
                LedgerEntry.create.called
            ).to.equal(true);

        }
    );

    /**
     * =========================================================================
     * Account Updates
     * =========================================================================
     */

    it(
        'postTransaction should update affected accounts',
        async function () {

            await ledgerService.postTransaction({

                tenantId:
                    'tenant1',

                debitAccountId:
                    'acc1',

                creditAccountId:
                    'acc2',

                amount:
                    75,

                reference:
                    'ref-mocha-account-update',

                description:
                    'Account update test'

            });

            expect(
                Account.findByIdAndUpdate.called
            ).to.equal(true);

            expect(
                Account.findByIdAndUpdate.callCount
            ).to.be.at.least(1);

        }
    );

    /**
     * =========================================================================
     * Rollback On Failure
     * =========================================================================
     */

    it(
        'postTransaction should abort the transaction when persistence fails',
        async function () {

            Transaction.create
                .rejects(
                    new Error(
                        'Database persistence failure'
                    )
                );

            try {

                await ledgerService.postTransaction({

                    tenantId:
                        'tenant1',

                    debitAccountId:
                        'acc1',

                    creditAccountId:
                        'acc2',

                    amount:
                        50,

                    reference:
                        'ref-mocha-failure',

                    description:
                        'Rollback test'

                });

                throw new Error(
                    'Expected ledger posting failure'
                );

            }
            catch (error) {

                expect(error)
                    .to.exist;

            }

            expect(
                session.startTransaction.calledOnce
            ).to.equal(true);

            expect(
                session.abortTransaction.calledOnce
            ).to.equal(true);

            expect(
                session.commitTransaction.called
            ).to.equal(false);

            expect(
                session.endSession.calledOnce
            ).to.equal(true);

        }
    );

});