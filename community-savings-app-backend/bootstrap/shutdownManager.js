class ShutdownManager {


    constructor(){

        this.handlers =
            [];

        this.shuttingDown =
            false;

    }



    register(
        name,
        handler
    ){

        this.handlers.push({

            name,

            handler

        });

    }





    async shutdown(
        reason
    ){


        if(
            this.shuttingDown
        ){

            return;

        }



        this.shuttingDown =
            true;



        console.log(
            "Shutdown:",
            reason
        );



        for(
            const item
            of this.handlers
        ){

            await item.handler();

        }


        process.exit(0);

    }


}



module.exports =
    ShutdownManager;