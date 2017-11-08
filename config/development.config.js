const LOCALHOST = '127.0.0.1';
//TODO add production.config.js
module.exports = {
    port: process.env.PORT || process.env.NODE_PORT || 8081,
    ssl: false,
    host: LOCALHOST,
    serverIp: LOCALHOST,
    mongodb: {
        host: LOCALHOST,
        port: '27017',
        user: process.env.MONGODB_USER || '',
        pass: process.env.MONGODB_PASS || '',
        defaultDB: {
            user: '$(mongodb.user)',
            pass: '$(mongodb.pass)',
            name: 'airbnb-demand',
            connection: process.env.UD_MONGODB_CONNECTION || 'mongodb://$(mongodb.host):$(mongodb.port)/$(mongodb.defaultDB.name)'
       }
   }
};

