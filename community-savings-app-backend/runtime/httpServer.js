const http =
require("http");



function createHTTPServer(app) {


    return http.createServer(
        app
    );

}



module.exports = {

    createHTTPServer

};