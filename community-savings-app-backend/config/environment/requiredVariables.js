function extractRequiredVariables(
    environment,
    required=[]
) {


    const missing = [];



    for(
        const variable
        of required
    ) {


        if(
            !environment[variable]
        ) {


            missing.push(variable);

        }

    }



    return {

        valid:
            missing.length === 0,


        missing

    };

}



module.exports = {

    extractRequiredVariables

};