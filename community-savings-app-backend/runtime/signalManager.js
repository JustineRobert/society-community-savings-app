class SignalManager {


    constructor(){

        this.handlers =
            {};

    }



    register(
        signal,
        callback
    ){

        process.on(
            signal,
            callback
        );

    }





    registerShutdown(
        callback
    ){


        this.register(
            "SIGTERM",
            callback
        );


        this.register(
            "SIGINT",
            callback
        );


    }





    registerFatalHandlers(
        callback
    ){


        process.on(

            "uncaughtException",

            callback

        );


        process.on(

            "unhandledRejection",

            callback

        );


    }


}



module.exports =
    SignalManager;