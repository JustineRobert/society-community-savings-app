//Ledger Service (services/ledgerService.js)
const Wallet = require("../models/Wallet");
const LedgerEntry = require("../models/LedgerEntry");

exports.processTransaction = async ({
  fromWalletId,
  toWalletId,
  amount,
  currency = "UGX",
  transactionId,
  description
}) => {
  const session = await Wallet.startSession();
  session.startTransaction();

  try {
    const fromWallet = await Wallet.findById(fromWalletId).session(session);
    const toWallet = await Wallet.findById(toWalletId).session(session);

    if (!fromWallet || !toWallet) throw new Error("Wallet not found");
    if (fromWallet.availableBalance < amount) throw new Error("Insufficient funds");

    // 🔴 DEBIT
    await LedgerEntry.create([{
      transactionId,
      walletId: fromWalletId,
      type: "DEBIT",
      amount,
      currency,
      reference: description,
      status: "COMPLETED"
    }], { session });

    // 🟢 CREDIT
    await LedgerEntry.create([{
      transactionId,
      walletId: toWalletId,
      type: "CREDIT",
      amount,
      currency,
      reference: description,
      status: "COMPLETED"
    }], { session });

    // Update balances
    fromWallet.availableBalance -= amount;
    toWallet.availableBalance += amount;

    await fromWallet.save({ session });
    await toWallet.save({ session });

    await session.commitTransaction();
    return { success: true, transactionId };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};
