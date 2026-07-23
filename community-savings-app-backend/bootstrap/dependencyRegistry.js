class DependencyRegistry {


    constructor(){

        this.dependencies =
            [];

    }



    register(
        name,
        initializer,
        options={}
    ){

        this.dependencies.push({

            name,

            initializer,

            critical:
                options.critical !== false

        });

    }




    async initialize(
        context
    ){


        for(
            const dependency
            of this.dependencies
        ){


            await dependency
                .initializer(
                    context
                );

        }

    }


}



module.exports =
    DependencyRegistry;