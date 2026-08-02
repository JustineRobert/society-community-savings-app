/**
 * TITech Community capital LTD
 * Compliance Decision Engine
 */


const DECISIONS =
Object.freeze({

APPROVE:"APPROVE",

REVIEW:"REVIEW",

BLOCK:"BLOCK"

});



class ComplianceDecisionEngine {


evaluate({

fraud,

aml,

kyc

}){


if(
fraud.riskScore >=70
){

return {

decision:
DECISIONS.BLOCK,


reason:
"FRAUD_RISK"

};

}



if(
!aml.passed ||
!kyc.passed
){

return {

decision:
DECISIONS.REVIEW,


reason:
"COMPLIANCE_REVIEW"

};

}



return {

decision:
DECISIONS.APPROVE

};


}



}



module.exports =
new ComplianceDecisionEngine();