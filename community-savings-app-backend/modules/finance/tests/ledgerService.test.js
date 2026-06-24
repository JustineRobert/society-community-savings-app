// backend/modules/finance/tests/ledgerService.test.js

const mongoose = require('mongoose');
const ledgerService = require('../services/ledgerService');
const Account = require('../models/Account');
const LedgerEntry = require('../models/LedgerEntry');
const Transaction = require('../models/Transaction');
const { checkDuplicate } = require('../utils/idempotency');

jest.mock('../models/Account');
jest.mock('../models/LedgerEntry');
jest.mock('../models/Transaction');
jest.mock('../utils/idempotency');

describe('Ledger Service (Jest)', () => {
  let session;

  beforeEach(async () => {
    session = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    };
    mongoose.startSession = jest.fn().mockResolvedValue(session);

    checkDuplicate.mockResolvedValue(true);
    Transaction.create.mockResolvedValue([{ _id: 'tx123', save: jest.fn() }]);
    LedgerEntry.create.mockResolvedValue(true);
    Account.findByIdAndUpdate.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('postTransaction', () => {
    it('creates transaction, ledger entries, updates balances and commits', async () => {
      const res = await ledgerService.postTransaction({
        tenantId: 'tenant1',
        debitAccountId: 'acc-debit',
        creditAccountId: 'acc-credit',
        amount: 100,
        reference: 'ref-001',
        description: 'Test payment'
      });

      expect(checkDuplicate).toHaveBeenCalledWith('ref-001');
      expect(Transaction.create).toHaveBeenCalled();
      expect(LedgerEntry.create).toHaveBeenCalledTimes(1);
      expect(Account.findByIdAndUpdate).toHaveBeenCalledTimes(2);
      expect(session.commitTransaction).toHaveBeenCalled();
      expect(res).toEqual({ success: true, transactionId: 'tx123' });
    });

    it('throws on invalid amount', async () => {
      await expect(ledgerService.postTransaction({
        tenantId: 'tenant1',
        debitAccountId: 'acc-debit',
        creditAccountId: 'acc-credit',
        amount: -10,
        reference: 'ref-002',
        description: 'Bad amount'
      })).rejects.toThrow("Amount must be a positive number");
    });
  });

  describe('recordBalancedTransaction', () => {
    it('delegates to postTransaction when amounts match', async () => {
      const res = await ledgerService.recordBalancedTransaction({
        tenantId: 'tenant1',
        debitAccountId: 'acc-debit',
        creditAccountId: 'acc-credit',
        debitAmount: 250,
        creditAmount: 250,
        reference: 'ref-003',
        description: 'Balanced'
      });

      expect(Transaction.create).toHaveBeenCalled();
      expect(LedgerEntry.create).toHaveBeenCalled();
      expect(res).toEqual({ success: true, transactionId: 'tx123' });
    });

    it('throws when debit and credit differ', async () => {
      await expect(ledgerService.recordBalancedTransaction({
        tenantId: 'tenant1',
        debitAccountId: 'acc-debit',
        creditAccountId: 'acc-credit',
        debitAmount: 100,
        creditAmount: 200,
        reference: 'ref-004',
        description: 'Unbalanced'
      })).rejects.toThrow("Ledger imbalance: debit and credit amounts must be equal");
    });
  });
});
