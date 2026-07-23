function normalizeURL(
    value,
    defaultValue=null
) {


    if (!value) {

        return defaultValue;

    }



    try {


        const url =
            new URL(value);



        return url.toString();



    }

    catch(error) {


        return defaultValue;

    }

}



module.exports = {
    normalizeURL
};