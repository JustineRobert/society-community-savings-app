function buildNamespaces(env) {


    return {


        server:
        {

            port:
                Number(env.PORT || 5000),


            environment:
                env.NODE_ENV ||
                "development"

        },



        database:
        {

            host:
                env.DB_HOST,


            port:
                Number(
                    env.DB_PORT || 27017
                ),


            username:
                env.DB_USERNAME,


            password:
                env.DB_PASSWORD

        },



        redis:
        {

            enabled:
                env.REDIS_ENABLED === "true",


            url:
                env.REDIS_URL

        },



        jwt:
        {

            accessSecret:
                env.JWT_ACCESS_SECRET,


            refreshSecret:
                env.JWT_REFRESH_SECRET

        },



        mobileMoney:
        {

            providers:
                env.MOBILE_MONEY_PROVIDERS

        }


    };

}



module.exports = {

    buildNamespaces

};