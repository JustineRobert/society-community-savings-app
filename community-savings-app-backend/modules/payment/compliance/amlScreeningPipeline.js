/**
 * TITech Community Capital LTD
 * AML Screening Pipeline
 *
 * Anti-money laundering controls.
 */


class AMLScreeningPipeline {


constructor(){

this.blacklist = new Set();

}



async execute(transaction){


const findings=[];



if(
this.blacklist.has(
transaction.customerId
)
){

findings.push(
"BLACKLIST_MATCH"
);

}



if(
transaction.amount >
transaction.reportingThreshold
){

findings.push(
"REPORTABLE_TRANSACTION"
);

}



return {

passed:
findings.length===0,


findings,


requiresReview:
findings.length>0

};


}



addBlacklistEntry(id){

this.blacklist.add(id);

}


}



module.exports =
new AMLScreeningPipeline();