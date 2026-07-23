class RequestDrain {


    constructor(server){

        this.server =
            server;


        this.connections =
            new Set();

    }




    attach(){


        this.server.on(

            "connection",

            socket=>{


                this.connections
                    .add(socket);



                socket.on(
                    "close",
                    ()=>{
                        this.connections
                            .delete(socket);
                    }
                );


            }

        );


    }





    async drain(
        timeout = 30000
    ){


        return new Promise(
            resolve=>{


                this.server.close(
                    ()=>{
                        resolve();
                    }
                );



                setTimeout(
                    ()=>{


                        for(
                            const socket
                            of this.connections
                        ){

                            socket.destroy();

                        }


                        resolve();


                    },

                    timeout

                );


            }
        );

    }


}



module.exports =
    RequestDrain;