// services/wallet.service.js

const Wallet = require("../models/Wallet");

exports.creditWallet = async (userId, amount) => {
  const wallet = await Wallet.findOne({ user: userId });

  if (!wallet) throw new Error("Wallet not found");

  wallet.balance += amount;
  await wallet.save();

  return wallet;
};

exports.debitWallet = async (userId, amount) => {
  const wallet = await Wallet.findOne({ user: userId });

  if (!wallet) throw new Error("Wallet not found");

  if (wallet.balance < amount) {
    throw new Error("Insufficient balance");
  }

  wallet.balance -= amount;
  await wallet.save();

  return wallet;
};