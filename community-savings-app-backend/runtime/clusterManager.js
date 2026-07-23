class ClusterManager {


    constructor(){

        this.workerId =
            process.pid;

    }



    identity(){


        return {


            pid:
                this.workerId,


            hostname:
                require("os")
                    .hostname()


        };


    }


}



module.exports =
    ClusterManager;