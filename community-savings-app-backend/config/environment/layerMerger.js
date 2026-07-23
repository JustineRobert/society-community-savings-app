const {
    createEnvironmentSnapshot
} = require("./environmentSnapshot");


/**
 * TITech Community Capital LTD
 * Merge dotenv layers into effective environment.
 *
 * Higher precedence layers override lower ones.
 *
 * @param {Array} layers
 * @param {Object} options
 */

function mergeEnvironmentLayers(
    layers,
    options = {}
) {


    const {

        includeProcessEnv = true,

        processEnvWins = true

    } = options;



    const values = {};

    const sources = {};

    const duplicates = [];



    /**
     * Load dotenv layers
     *
     * Lowest priority first
     * Highest priority last
     */

    for (const layer of layers) {


        const {

            file,

            variables

        } = layer;



        for (const [
            key,
            value
        ] of Object.entries(variables)) {



            if (
                Object.prototype.hasOwnProperty.call(
                    values,
                    key
                )
            ) {


                duplicates.push({

                    key,

                    previousSource:
                        sources[key],

                    newSource:
                        file,


                    previousValue:
                        values[key],

                    newValue:
                        value

                });

            }



            values[key] = value;

            sources[key] = file;

        }

    }




    /**
     * Merge OS environment.
     *
     * Default:
     * process.env wins.
     */

    if (includeProcessEnv) {


        for (
            const [
                key,
                value
            ]
            of Object.entries(process.env)
        ) {


            if (
                Object.prototype.hasOwnProperty.call(
                    values,
                    key
                )
            ) {


                duplicates.push({

                    key,

                    previousSource:
                        sources[key],

                    newSource:
                        "process.env",

                    previousValue:
                        values[key],

                    newValue:
                        value

                });

            }



            if (processEnvWins) {


                values[key] = value;

                sources[key] =
                    "process.env";


            }


        }

    }




    return createEnvironmentSnapshot({

        values,

        sources,

        duplicates,

        layers

    });


}



module.exports = {
    mergeEnvironmentLayers
};