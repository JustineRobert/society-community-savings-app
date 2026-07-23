/**
 * TITech Community Capital LTD
 * Immutable bootstrap runtime state.
 *
 * Created once during application startup.
 */


function createBootstrapState({

    config,

    sources,

    loadedFiles = [],

    warnings = [],

    errors = [],

    metadata = {}

}) {


    const state = {


        status:
            errors.length
                ? "FAILED"
                : "READY",



        config:
            Object.freeze({
                ...config
            }),



        sources:
            Object.freeze({
                ...sources
            }),



        loadedFiles:
            Object.freeze([
                ...loadedFiles
            ]),



        diagnostics:
            Object.freeze({

                warnings:
                    Object.freeze([
                        ...warnings
                    ]),


                errors:
                    Object.freeze([
                        ...errors
                    ]),


                warningCount:
                    warnings.length,


                errorCount:
                    errors.length

            }),



        metadata:
            Object.freeze({

                createdAt:
                    new Date().toISOString(),


                ...metadata

            })

    };



    return Object.freeze(state);

}



module.exports = {
    createBootstrapState
};