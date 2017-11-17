// This config file will be read when NODE_ENV environment variable equals 'production'.
// Update data below to your own production environment.

const MLAB_HOST = 'ds113386-a0.mlab.com'
module.exports = {
    port: process.env.PORT || process.env.NODE_PORT || 8081,
    ssl: false,
    host: MLAB_HOST,
    serverIp: MLAB_HOST,
    mongodb: {
        host: MLAB_HOST,
        port: '13386',
        user: process.env.MONGODB_USER || 'airbnbdemanduser', // normally this should be in an environment var or config var
        pass: process.env.MONGODB_PASS || 'airbnbdemanduser', // normally this should be in an environment var or config var
        defaultDB: {
            user: '$(mongodb.user)',
            pass: '$(mongodb.pass)',
            name: 'airbnb-demand-1',
            connection: process.env.UD_MONGODB_CONNECTION || 'mongodb://$(mongodb.host):$(mongodb.port)/$(mongodb.defaultDB.name)'
       }
   }
};

