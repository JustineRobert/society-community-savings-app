// backend/modules/finance/tests/ledgerService.mocha.test.js

const sinon = require('sinon');
const { expect } = require('chai');
const mongoose = require('mongoose');

const ledgerService = require('../services/ledgerService');
const Account = require('../models/Account');
const LedgerEntry = require('../models/LedgerEntry');
const Transaction = require('../models/Transaction');
const idempotency = require('../utils/idempotency');

describe('Ledger Service (Mocha)', () => {
  let sandbox;
  let session;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    session = {
      startTransaction: sandbox.stub(),
      commitTransaction: sandbox.stub(),
      abortTransaction: sandbox.stub(),
      endSession: sandbox.stub(),
    };

    sandbox.stub(mongoose, 'startSession').resolves(session);
    sandbox.stub(idempotency, 'checkDuplicate').resolves(true);
    sandbox.stub(Transaction, 'create').resolves([{ _id: 'tx123', save: sandbox.stub() }]);
    sandbox.stub(LedgerEntry, 'create').resolves(true);
    sandbox.stub(Account, 'findByIdAndUpdate').resolves(true);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('postTransaction should complete flow', async () => {
    const res = await ledgerService.postTransaction({
      tenantId: 'tenant1',
      debitAccountId: 'acc1',
      creditAccountId: 'acc2',
      amount: 50,
      reference: 'ref-mocha-1',
      description: 'Mocha test'
    });

    expect(res).to.deep.equal({ success: true, transactionId: 'tx123' });
  });

  it('recordBalancedTransaction should reject unbalanced amounts', async () => {
    try {
      await ledgerService.recordBalancedTransaction({
        tenantId: 'tenant1',
        debitAccountId: 'acc1',
        creditAccountId: 'acc2',
        debitAmount: 10,
        creditAmount: 20,
        reference: 'ref-mocha-2',
        description: 'Unbalanced'
      });
      throw new Error('Expected error not thrown');
    } catch (err) {
      expect(err.message).to.equal('Ledger imbalance: debit and credit amounts must be equal');
    }
  });
});
