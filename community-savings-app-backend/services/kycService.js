function validateTransaction(user, amount) {
  const limits = {
    TIER_1: 500000,
    TIER_2: 2000000,
    TIER_3: Infinity,
  };

  const limit = limits[user.kycLevel || "TIER_1"];

  if (amount > limit) {
    throw new Error("Transaction exceeds KYC limit");
  }

  return true;
}

module.exports = { validateTransaction };