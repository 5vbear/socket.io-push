module.exports = SimpleRedisHashCluster;

const commands = require('redis-commands');
const IoRedis = require('ioredis');
const util = require("./util.js");
const logger = require('winston-proxy')('SimpleRedisHashCluster');

const REDIS_MASTER = 'master';    // ioreids use when fetch sentinel
const REDIS_SLAVE = 'slave';     // ioreids use when fetch sentinel


function defaultRetryStrategy(times) {
    const delay = Math.min(times * 300, 2000);
    return delay;
}

const defaultConnectTimeout = 10000000000000000;

function SimpleRedisHashCluster(config) {
    if (!(this instanceof SimpleRedisHashCluster)) return new SimpleRedisHashCluster(config);
    this.messageCallbacks = [];
    this.write = getClientsFromIpList(config.write);
    this.read = getClientsFromIpList(config.read);
    this.event = getClientsFromIpList(config.event);
    if (this.read.length == 0) {
        logger.info("read slave not in config using write");
        this.read = this.write;
    }
    const self = this;

    this.sub = [];
    if (config.sub) {
        if (Array.isArray(config.sub)) {
            logger.debug("sub using direct redis", config.sub);
            this.sub = getClientsFromIpList(config.sub, this);
        } else {
            logger.debug("sub using sentinel", config.sub);
            this.sub = getClientsFromSentinel(config.sub.sentinel, config.sub.groupName, config.sub.password, REDIS_SLAVE, this);
        }
    }

    this.pubs = [];
    if (config.pubs) {
        config.pubs.forEach(function (pub) {
            if (Array.isArray(pub)) {
                logger.debug("pub using direct redis", pub);
                self.pubs.push(getClientsFromIpList(pub));
            } else {
                logger.debug("pub using sentinel", pub);
                self.pubs.push(getClientsFromSentinel(pub.sentinel, pub.groupName, pub.password, REDIS_MASTER));
            }
        });
    }
}

function getClientsFromSentinel(sentinels, names, password, role, subscribe) {
    const clients = [];
    if (names) {
        names.forEach(function (name) {
            const client = new IoRedis({
                sentinels: sentinels,
                name: name,
                role: role,
                password: password,
                retryStrategy: function (times) {
                    const delay = Math.min(times * 300, 2000);
                    return delay;
                },
                connectTimeout: 10000000000000000
            });
            client.on("error", function (err) {
                logger.error("pub/sub redis error %s", err);
            });
            if (subscribe) {
                client.on("messageBuffer", function (channel, message) {
                    subscribe.messageCallbacks.forEach(function (callback) {
                        try {
                            callback(channel, message);
                        } catch (err) {
                            logger.error("pub/sub redis message error %s", err);
                        }
                    });
                });
            }
            clients.push(client);
        });
    }
    return clients;
}

function getClientsFromIpList(addrs, subscribe) {
    const clients = [];
    if (addrs) {
        addrs.forEach(function (addr) {

            if (!addr.retryStrategy) {
                addr.retryStrategy = defaultRetryStrategy;
            }
            if (!addr.connectTimeout) {
                addr.connectTimeout = defaultConnectTimeout;
            }
            const client = new IoRedis(addr);
            client.on("error", function (err) {
                logger.error("redis error", err);
            });
            if (subscribe) {
                client.on("messageBuffer", function (channel, message) {
                    subscribe.messageCallbacks.forEach(function (callback) {
                        try {
                            callback(channel, message);
                        } catch (err) {
                            logger.error("redis message error %s", err);
                        }
                    });
                });
            }
            clients.push(client);
        });
    }
    return clients;
}

commands.list.forEach(function (command) {

    SimpleRedisHashCluster.prototype[command.toUpperCase()] = SimpleRedisHashCluster.prototype[command] = function (key, arg, callback) {
        const client = util.getByHash(this.write, key);
        handleCommand(command, arguments, client);
    }

});

['publish'].forEach(function (command) {

    SimpleRedisHashCluster.prototype[command.toUpperCase()] = SimpleRedisHashCluster.prototype[command] = function (key, arg, callback) {
        if (key == "event#client") {
            const client = util.getByHash(this.event, key);
            handleCommandBuffer(command, arguments, client);
        } else {
            const args = arguments;
            this.pubs.forEach(function (pub) {
                const client = util.getByHash(pub, key);
                handleCommandBuffer(command, args, client);
            });
        }
    }

});

['subscribe', 'unsubscribe'].forEach(function (command) {

    SimpleRedisHashCluster.prototype[command.toUpperCase()] = SimpleRedisHashCluster.prototype[command] = function (key, arg, callback) {
        const client = util.getByHash(this.sub, key);
        handleCommandBuffer(command, arguments, client);
    }

});

['get', 'hkeys', 'hgetall', 'pttl', 'lrange'].forEach(function (command) {

    SimpleRedisHashCluster.prototype[command.toUpperCase()] = SimpleRedisHashCluster.prototype[command] = function (key, arg, callback) {
        const client = util.getByHash(this.read, key);
        handleCommand(command, arguments, client);
    }
});


SimpleRedisHashCluster.prototype.hscanStream = function (key, opts) {
    const client = util.getByHash(this.read, key);
    return client.hscanStream(key, opts || {});
};

SimpleRedisHashCluster.prototype.call = function (command, key) {
    const client = util.getByHash(this.write, key);
    return client.call.apply(client, arguments);
};


SimpleRedisHashCluster.prototype["HHSET"] =
    SimpleRedisHashCluster.prototype["hhset"] = function (key, field, value, callback) {
        const client = util.getByHash(this.write, field);
        return client.call.apply(client, ["hset"].concat(toArray(arguments)));
    };

SimpleRedisHashCluster.prototype["HHGET"] =
    SimpleRedisHashCluster.prototype["hhget"] = function (key, field, callback) {
        const client = util.getByHash(this.read, field);
        return client.call.apply(client, ["hget"].concat(toArray(arguments)));
    };

SimpleRedisHashCluster.prototype["HHDEL"] =
    SimpleRedisHashCluster.prototype["hhdel"] = function(key, field, callback) {
        const client = util.getByHash(this.write, field);
        return client.call.apply(client, ["hdel"].concat(toArray(arguments)));
    };

SimpleRedisHashCluster.prototype["HHINCRBY"] =
    SimpleRedisHashCluster.prototype["hhincrby"] = function (key, field, value, callback) {
        const client = util.getByHash(this.write, field);
        return client.call.apply(client, ["hincrby"].concat(toArray(arguments)));
    };

SimpleRedisHashCluster.prototype.hhscanStream = function (key, opts) {
    let hhstream = [];
    this.read.forEach(function (client) {
        let stream = client.hscanStream(key, opts || {});
        hhstream.push(stream);
    });
    return util.scanHelper(hhstream);
};

function handleCommand(command, callArguments, client) {
    if (!client) {
        logger.error("handleCommand error no client %j", callArguments);
        return;
    }
    return client.call.apply(client, [command].concat(toArray(callArguments)));
}


function handleCommandBuffer(command, callArguments, client) {
    if (!client) {
        logger.error("handleCommand error no client %j", callArguments);
        return;
    }
    return client.callBuffer.apply(client, [command].concat(toArray(callArguments)));
}

SimpleRedisHashCluster.prototype.hash = function (key, callback) {
    const client = util.getByHash(this.read, key);
    callback({host: client.options.host, port: client.options.port});
}


SimpleRedisHashCluster.prototype.on = function (message, callback) {
    if (message === "message") {
        logger.debug("on message ");
        this.messageCallbacks.push(callback);
    } else {
        const err = "on " + message + " not supported";
        logger.error(error);
        throw err;
    }
}


SimpleRedisHashCluster.prototype.status = function () {
    let masterError = 0;
    this.pubs.forEach(function (pub) {
        pub.forEach(function (master) {
            master.status !== 'ready' && masterError++;
        });
    });
    let slaveError = 0;
    this.sub.forEach(function (slave) {
        slave.status !== 'ready' && slaveError++;
    });
    return {masterError: masterError, slaveError: slaveError};
}

function toArray(args) {
    const len = args.length;
    const arr = new Array(len);

    for (let i = 0; i < len; i += 1) {
        arr[i] = args[i];
    }

    return arr;
}
