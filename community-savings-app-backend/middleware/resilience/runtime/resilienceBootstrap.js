'use strict';


const ResilienceContainer =
require(
    './resilienceContainer'
);


const {
    registerDependencies
}
=
require(
    './resilienceDependencies'
);



const ResilienceRuntime =
require(
    './resilienceRuntime'
);



async function bootstrapResilience(
    options={}
)
{


    const container =
        new ResilienceContainer();



    registerDependencies(

        container,

        options.dependencies

    );



    const runtime =
        new ResilienceRuntime({

            container,

            config:
                options.config

        });



    await runtime.initialize();



    return runtime;

}



module.exports =
{

    bootstrapResilience

};