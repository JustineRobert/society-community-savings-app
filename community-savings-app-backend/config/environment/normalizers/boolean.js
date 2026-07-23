/**
 * Convert environment strings into booleans.
 */


function parseBoolean(value, defaultValue = false) {


    if (value === undefined || value === null) {

        return defaultValue;

    }


    if (typeof value === "boolean") {

        return value;

    }



    return [

        "true",
        "1",
        "yes",
        "on",
        "enabled"

    ]
    .includes(
        String(value)
            .toLowerCase()
            .trim()
    );

}



module.exports = {
    parseBoolean
};