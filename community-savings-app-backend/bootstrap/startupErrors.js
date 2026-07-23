class BootstrapError extends Error {


    constructor(
        message,
        details={}
    ){

        super(message);

        this.name =
            "BootstrapError";

        this.details =
            details;

    }

}



class DependencyInitializationError
    extends BootstrapError {}



class ShutdownError
    extends BootstrapError {}



module.exports = {

    BootstrapError,

    DependencyInitializationError,

    ShutdownError

};