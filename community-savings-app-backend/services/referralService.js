const Referral = require('../models/Referral');
const crypto = require('crypto');

class ReferralService {
  async generateCode(userId){
    const code = (crypto.randomBytes(4).toString('hex')).toUpperCase();
    await Referral.create({ code, referrer: userId });
    return code;
  }

  async redeemCode(code, referredUserId){
    const rec = await Referral.findOne({ code });
    if(!rec) throw new Error('Invalid code');
    if(rec.referrer.equals(referredUserId)) throw new Error('Self-referral not allowed');
    if(rec.used) throw new Error('Code already used');
    rec.referredUser = referredUserId; rec.used = true; await rec.save();
    return rec;
  }
}

module.exports = new ReferralService();
