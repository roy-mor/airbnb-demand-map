const LOCALHOST = '127.0.0.1';
const MLAB_HOST = 'ds151355.mlab.com'
module.exports = {
    port: process.env.PORT || process.env.NODE_PORT || 8081,
    ssl: false,
    host: MLAB_HOST,
    serverIp: MLAB_HOST,
    mongodb: {
        host: MLAB_HOST,
        port: '51355',
        user: process.env.MONGODB_USER || 'airbnbdemand', // normally this should be in an environment var or config var
        pass: process.env.MONGODB_PASS || 'airbnbdemand', // normally this should be in an environment var or config var
        defaultDB: {
            user: '$(mongodb.user)',
            pass: '$(mongodb.pass)',
            name: 'airbnb-demand',
            connection: process.env.UD_MONGODB_CONNECTION || 'mongodb://$(mongodb.host):$(mongodb.port)/$(mongodb.defaultDB.name)'
       }
   }
};

