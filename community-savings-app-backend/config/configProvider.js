const ConfigurationProvider =
require(
"./provider/ConfigurationProvider"
);



const createNamespaceAccess =
require(
"./provider/namespaceAccess"
);



let INSTANCE = null;




function initializeConfiguration(
config
) {


    if(INSTANCE) {


        throw new Error(
            "Configuration already initialized"
        );

    }



    const provider =
        new ConfigurationProvider(
            config
        );



    INSTANCE =
        Object.assign(

            provider,

            createNamespaceAccess(
                provider
            )

        );



    return INSTANCE;

}




function getConfiguration() {


    if(!INSTANCE) {


        throw new Error(
            "Configuration provider not initialized"
        );

    }



    return INSTANCE;

}




module.exports = {


    initializeConfiguration,

    getConfiguration

};