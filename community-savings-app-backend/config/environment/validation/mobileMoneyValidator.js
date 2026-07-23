function validateMobileMoney(
    config,
    report
) {


    if(
        !config.mobileMoney
    ) {


        report.warning(

            "Mobile money configuration unavailable"

        );


        return;

    }



    const providers =
        config.mobileMoney.providers;



    if(
        providers.length === 0
    ) {


        report.warning(

            "No mobile money providers configured"

        );

    }



    report.addCheck(

        "Mobile money configuration",

        true

    );

}



module.exports = {

    validateMobileMoney

};