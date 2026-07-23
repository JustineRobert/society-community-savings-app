/**
 * TITech Community Capital LTD
 * Immutable runtime environment snapshot.
 */


function createEnvironmentSnapshot({
    values,
    sources,
    duplicates,
    layers
}) {


    const snapshot = {

        values: Object.freeze({
            ...values
        }),


        sources: Object.freeze({
            ...sources
        }),


        diagnostics: Object.freeze({

            layersApplied:
                layers.length,

            duplicateCount:
                duplicates.length,

            duplicates:
                Object.freeze([
                    ...duplicates
                ])

        })

    };


    return Object.freeze(snapshot);
}



module.exports = {
    createEnvironmentSnapshot
};