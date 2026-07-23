const DependencyRegistry =
require("./dependencyRegistry");


const LifecycleManager =
require("./lifecycleManager");


const ShutdownManager =
require("./shutdownManager");


const ReadinessState =
require("./readinessState");



class ApplicationBootstrap {


    constructor(){


        this.dependencies =
            new DependencyRegistry();


        this.lifecycle =
            new LifecycleManager();


        this.shutdown =
            new ShutdownManager();


        this.readiness =
            new ReadinessState();


    }





    registerDependency(
        name,
        initializer,
        options
    ){

        this.dependencies.register(
            name,
            async(context)=>{


                try{


                    await initializer(
                        context
                    );


                    this.readiness
                        .markReady(
                            name
                        );


                }

                catch(error){


                    this.readiness
                        .markFailed(
                            name,
                            error
                        );


                    throw error;

                }


            },

            options
        );

    }





    async start(
        context={}
    ){


        try{


            await this.lifecycle
                .execute(
                    "beforeStart",
                    context
                );



            await this.dependencies
                .initialize(
                    context
                );



            await this.lifecycle
                .execute(
                    "afterStart",
                    context
                );



            return this.readiness
                .snapshot();


        }

        catch(error){


            await this.shutdown
                .shutdown(
                    error.message
                );


            throw error;

        }

    }





    registerShutdown(
        name,
        handler
    ){

        this.shutdown.register(
            name,
            handler
        );

    }


}



module.exports =
    ApplicationBootstrap;