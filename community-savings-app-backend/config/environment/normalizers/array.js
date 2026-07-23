/**
 * Converts:
 *
 * "a,b,c"
 *
 * into:
 *
 * ["a","b","c"]
 */


function parseArray(
    value,
    separator=","
) {


    if (!value) {

        return [];

    }



    if (Array.isArray(value)) {

        return value;

    }



    return String(value)

        .split(separator)

        .map(
            item =>
            item.trim()
        )

        .filter(Boolean);

}



module.exports = {
    parseArray
};