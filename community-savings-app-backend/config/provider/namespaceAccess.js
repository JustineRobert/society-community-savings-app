function createNamespaceAccess(
    provider
) {


    return {


        server() {


            return provider.get(
                "server"
            );

        },



        database() {


            return provider.get(
                "database"
            );

        },



        redis() {


            return provider.get(
                "redis"
            );

        },



        jwt() {


            return provider.get(
                "jwt"
            );

        },



        mobileMoney() {


            return provider.get(
                "mobileMoney"
            );

        },


        security() {


            return provider.get(
                "security"
            );

        }


    };


}



module.exports =
    createNamespaceAccess;