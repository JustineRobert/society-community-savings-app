const SECRET_FIELDS = [

    "PASSWORD",

    "SECRET",

    "TOKEN",

    "KEY",

    "PRIVATE"

];



function isSecret(name) {


    return SECRET_FIELDS.some(

        keyword =>
            name
            .toUpperCase()
            .includes(keyword)

    );

}



function maskSecrets(config) {


    const output = {};



    for (
        const [
            key,
            value
        ]
        of Object.entries(config)
    ) {


        output[key] =

            isSecret(key)

            ? "***"

            : value;


    }



    return output;

}



module.exports = {

    maskSecrets,

    isSecret

};