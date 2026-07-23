const {
    maskSecrets
}
=
require(
    "../environment/secretMasker"
);



class ConfigurationProvider {


    constructor(config = {}) {


        this.version =
            1;


        this.createdAt =
            new Date();



        this.runtimeConfig =
            Object.freeze(
                structuredClone(config)
            );



        this.tenantOverrides =
            new Map();



        this.hooks =
            [];

    }




    /**
     * Generic configuration access
     */

    get(path, fallback = undefined) {


        const parts =
            path.split(".");


        let current =
            this.runtimeConfig;



        for(
            const part
            of parts
        ) {


            if(
                current[part] === undefined
            ) {

                return fallback;

            }


            current =
                current[part];

        }



        return current;

    }





    /**
     * Replace configuration.
     *
     * Used by dynamic reload mechanisms.
     */

    update(config) {


        this.runtimeConfig =
            Object.freeze(
                structuredClone(config)
            );


        this.version++;


        this.executeHooks();


    }




    registerHook(callback) {


        this.hooks.push(
            callback
        );

    }





    executeHooks() {


        for(
            const hook
            of this.hooks
        ) {


            hook(
                this.version
            );

        }

    }




    diagnostics() {


        return {


            version:
                this.version,


            createdAt:
                this.createdAt,


            configuration:
                maskSecrets(
                    this.runtimeConfig
                )

        };

    }



}



module.exports =
    ConfigurationProvider;