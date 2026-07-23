function validateRequired(
    config,
    environment,
    report
) {



    if(
        environment === "production"
    ) {


        const required = [

            config.database.host,

            config.database.username,

            config.jwt.accessSecret,

            config.jwt.refreshSecret

        ];



        required.forEach(
            value => {


                if(!value) {


                    report.error(
                        "Missing required production configuration"
                    );


                }


            }
        );


    }



    report.addCheck(

        "Required variables",

        report.errors.length === 0

    );

}



module.exports = {

    validateRequired

};