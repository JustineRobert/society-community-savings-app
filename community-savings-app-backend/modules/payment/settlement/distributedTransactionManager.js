/**
 * TITech Community Capital LTD
 * Distributed Transaction Coordinator
 *
 * Coordinates operations across:
 *
 * Ledger
 * Settlement
 * Events
 * Audit
 */


class DistributedTransactionManager {


constructor(){

this.operations=[];

}



register(
operation
){

this.operations.push(operation);

}



async commit(){

const completed=[];


try{


for(
const operation of this.operations
){

const result =
await operation.execute();


completed.push({

operation,

result

});


}


return {

success:true,

completed

};


}

catch(error){


await this.rollback(
completed
);


throw error;

}



}



async rollback(
completed
){


for(
const item of completed.reverse()
){

if(
item.operation.rollback
){

await item.operation.rollback();

}

}


}



clear(){

this.operations=[];

}


}



module.exports =
DistributedTransactionManager;