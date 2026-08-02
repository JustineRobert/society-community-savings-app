/**
 * TITech Community Capital LTD
 * Fraud Detection Pipeline
 *
 * Executes fraud rules before
 * ledger posting.
 */


const riskEngine =
require("./riskScoringEngine");



class FraudDetectionPipeline {


async execute(paymentContext){


const risk =
riskEngine.calculate({

amount:
paymentContext.amount,


threshold:
paymentContext.threshold || 1000000,


transactionVelocity:
paymentContext.velocity || 0,


failedAttempts:
paymentContext.failedAttempts,


kycStatus:
paymentContext.kycStatus,


amlMatch:
paymentContext.amlMatch

});



return {

passed:
risk.score < 70,


riskScore:
risk.score,


riskLevel:
risk.level,


reasons:
risk.reasons


};


}



}


module.exports =
new FraudDetectionPipeline();