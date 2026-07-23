class FeatureFlagManager {


    constructor(flags = {}) {


        this.flags =
            Object.freeze({
                ...flags
            });

    }



    enabled(name) {


        return Boolean(
            this.flags[name]
        );

    }




    all() {


        return {
            ...this.flags
        };

    }


}



module.exports =
    FeatureFlagManager;