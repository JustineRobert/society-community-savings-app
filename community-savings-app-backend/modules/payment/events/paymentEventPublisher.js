/**
 * TITech Community Capital LTD
 * Payment Domain Events
 */


class PaymentEventPublisher {


constructor(){

this.listeners=[];

}



subscribe(listener){

this.listeners.push(listener);

}



async publish(event){


for(
const listener of this.listeners
){

await listener(event);

}


}



}



module.exports =
new PaymentEventPublisher();