class ConfigurationHooks {


    constructor() {


        this.listeners =
            [];

    }




    subscribe(callback) {


        this.listeners.push(
            callback
        );

    }




    emit(event) {


        this.listeners.forEach(

            listener =>
                listener(event)

        );

    }


}



module.exports =
    ConfigurationHooks;