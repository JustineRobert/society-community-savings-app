class LifecycleManager {


    constructor(){

        this.hooks = {

            beforeStart:[],

            afterStart:[],

            beforeShutdown:[],

            afterShutdown:[]

        };

    }



    register(
        type,
        callback
    ){

        this.hooks[type]
            .push(callback);

    }




    async execute(
        type,
        context
    ){

        for(
            const hook
            of this.hooks[type]
        ){

            await hook(
                context
            );

        }

    }


}



module.exports =
    LifecycleManager;