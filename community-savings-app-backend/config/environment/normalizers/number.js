function parseInteger(
    value,
    defaultValue = null
) {


    const parsed =
        Number.parseInt(
            value,
            10
        );


    return Number.isNaN(parsed)
        ? defaultValue
        : parsed;

}




function parseFloatNumber(
    value,
    defaultValue = null
) {


    const parsed =
        Number.parseFloat(
            value
        );


    return Number.isNaN(parsed)
        ? defaultValue
        : parsed;

}



module.exports = {

    parseInteger,

    parseFloatNumber

};