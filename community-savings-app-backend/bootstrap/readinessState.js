class ReadinessState {


    constructor(){

        this.state =
            "INITIALIZING";


        this.components =
            {};

    }



    markReady(
        component
    ){

        this.components[component] =
            "READY";


        this.evaluate();

    }



    markFailed(
        component,
        error
    ){

        this.components[component] =
        {

            status:"FAILED",

            error:
                error.message

        };


        this.state =
            "FAILED";

    }




    evaluate(){


        const failed =
            Object.values(
                this.components
            )
            .some(
                item =>
                item.status === "FAILED"
            );


        if(failed){

            this.state =
                "FAILED";

            return;

        }



        const pending =
            Object.values(
                this.components
            )
            .some(
                item =>
                item !== "READY"
            );


        if(!pending){

            this.state =
                "READY";

        }


    }




    snapshot(){

        return {

            status:
                this.state,


            components:
                {
                    ...this.components
                }

        };

    }


}



module.exports =
    ReadinessState;