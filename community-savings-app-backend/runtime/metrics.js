class RuntimeMetrics {


    constructor(){

        this.startedAt =
            new Date();


    }



    snapshot(){


        return {


            uptime:

                process.uptime(),



            memory:

                process.memoryUsage(),



            pid:

                process.pid,


            startedAt:

                this.startedAt


        };


    }


}



module.exports =
    RuntimeMetrics;