class TenantConfigurationOverrides {


    constructor() {


        this.overrides =
            new Map();

    }





    set(
        tenantId,
        config
    ) {


        this.overrides.set(

            tenantId,

            Object.freeze(
                structuredClone(config)
            )

        );

    }





    get(
        tenantId
    ) {


        return (

            this.overrides.get(
                tenantId
            )

            ||

            {}

        );

    }




    remove(
        tenantId
    ) {


        this.overrides.delete(
            tenantId
        );

    }


}



module.exports =
    TenantConfigurationOverrides;