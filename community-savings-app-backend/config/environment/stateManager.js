const {
    createBootstrapState
}
=
require("./bootstrapState");



let INTERNAL_STATE = null;



/**
 * Initialize bootstrap state.
 *
 * Called once during application startup.
 */

function initializeBootstrapState(data) {


    if (INTERNAL_STATE) {


        throw new Error(
            "Bootstrap state already initialized"
        );

    }



    INTERNAL_STATE =
        createBootstrapState(data);



    return INTERNAL_STATE;

}



/**
 * Read immutable state.
 */

function getBootstrapState() {


    if (!INTERNAL_STATE) {


        throw new Error(
            "Bootstrap state not initialized"
        );

    }


    return INTERNAL_STATE;

}



module.exports = {

    initializeBootstrapState,

    getBootstrapState

};