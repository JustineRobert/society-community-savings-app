const {
    createHTTPServer
}
=
require("./httpServer");


const RequestDrain =
require("./requestDrain");


const SignalManager =
require("./signalManager");


const RuntimeMetrics =
require("./metrics");


const ClusterManager =
require("./clusterManager");



class ServerRuntime {


    constructor({

        app,

        config,

        bootstrap

    }){


        this.app =
            app;


        this.config =
            config;


        this.bootstrap =
            bootstrap;



        this.server =
            createHTTPServer(
                app
            );



        this.drain =
            new RequestDrain(
                this.server
            );



        this.signals =
            new SignalManager();



        this.metrics =
            new RuntimeMetrics();



        this.cluster =
            new ClusterManager();


    }





    async start(){


        this.drain.attach();



        const port =
            this.config
                .server()
                .port;



        await new Promise(
            resolve=>{


                this.server.listen(

                    port,

                    resolve

                );


            }
        );



        console.log(
            "HTTP server ready"
        );



        this.registerSignals();


        return {

            port,

            ...this.cluster.identity()

        };


    }







    registerSignals(){


        this.signals
            .registerShutdown(

                async()=>{


                    console.log(
                        "Graceful shutdown initiated"
                    );


                    await this.drain
                        .drain();


                    process.exit(0);


                }

            );




        this.signals
            .registerFatalHandlers(

                async(error)=>{


                    console.error(
                        error
                    );


                    await this.drain
                        .drain();


                    process.exit(1);


                }

            );


    }





    health(){

        return {

            runtime:
                this.metrics.snapshot(),


            cluster:
                this.cluster.identity()


        };


    }


}



module.exports =
    ServerRuntime;