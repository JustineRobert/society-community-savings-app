function displayStartupBanner({

    name,

    version,

    environment,

    port

}) {


console.log(`

=================================================

 ${name}

 Version: ${version}

 Environment: ${environment}

 Port: ${port}

 PID: ${process.pid}

 Started: ${new Date().toISOString()}

=================================================

`);


}



module.exports =
    displayStartupBanner;