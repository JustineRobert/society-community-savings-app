/**
 * TITech Community Capital LTD
 * Environment loader diagnostics collector.
 */


class EnvironmentDiagnostics {


    constructor() {


        this.loadedFiles = [];

        this.warnings = [];

        this.errors = [];

    }



    recordFile(file) {


        this.loadedFiles.push({

            file,

            loadedAt:
                new Date()

        });

    }



    warning(message, context = {}) {


        this.warnings.push({

            message,

            context,

            timestamp:
                new Date()

        });

    }




    error(error, context = {}) {


        this.errors.push({

            message:
                error.message,


            stack:
                error.stack,


            context,


            timestamp:
                new Date()

        });

    }



    snapshot() {


        return {


            loadedFiles:
                [
                    ...this.loadedFiles
                ],


            warnings:
                [
                    ...this.warnings
                ],


            errors:
                [
                    ...this.errors
                ]

        };


    }


}



module.exports =
    EnvironmentDiagnostics;