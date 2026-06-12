// services/billingEngine.js
module.exports = function calculateFee(type, amount) {
  switch(type) {
    case 'deposit': return amount * 0.01;
    case 'withdrawal': return 2000; // fixed fee
    case 'loan': return amount * 0.02;
    default: return 0;
  }
};
