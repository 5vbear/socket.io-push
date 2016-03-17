module.exports = TTLService;

var debug = require('debug')('TTLService');
var msgpack = require('msgpack-lite');
var randomstring = require("randomstring");

function TTLService(redis) {
    this.redis = redis;
}

TTLService.prototype.onPushId = function (socket, lastPacketId) {
    this.getPackets(socket.pushId, lastPacketId, socket);
}

var maxTllPacketPerTopic = -50;

TTLService.prototype.addPacketAndEmit = function (topic, event, timeToLive, packet, io, unicast) {
    debug("addPacket %s %s %s", topic, event, timeToLive);
    packet.id = randomstring.generate(12);
    if (timeToLive > 0) {
        packet.ttl = "";
        if (unicast) {
            packet.unicast = "";
        }
        var data = JSON.parse(JSON.stringify(packet));
        var redis = this.redis;
        data.timestampValid = Date.now() + timeToLive;
        data.event = event;
        var listKey = "ttl#packet#" + topic;
        redis.pttl(listKey, function (err, oldTtl) {
            debug("addPacket key %s , %d , %d", listKey, oldTtl, timeToLive);
            redis.rpush(listKey, JSON.stringify(data));
            redis.ltrim(listKey, maxTllPacketPerTopic, -1);
            if (timeToLive > oldTtl) {
                redis.pexpire(listKey, timeToLive);
            }
        });
    }
    io.to(topic).emit(event, msgpack.encode(packet));
};

TTLService.prototype.getPackets = function (topic, lastId, socket) {
    if (lastId) {
        var redis = this.redis;
        var listKey = "ttl#packet#" + topic;
        redis.lrange(listKey, 0, -1, function (err, list) {
            if (list) {
                var lastFound = false;
                var now = Date.now();
                list.forEach(function (packet) {
                    var jsonPacket = JSON.parse(packet);
                    var now = Date.now();
                    if (jsonPacket.id == lastId) {
                        lastFound = true;
                        debug("lastFound %s %s", jsonPacket.id, lastId);
                    } else if (lastFound == true && jsonPacket.timestampValid > now) {
                        debug("call emitPacket %s %s", jsonPacket.id, lastId);
                        emitPacket(socket, jsonPacket);
                    }
                });

                if (!lastFound) {
                    debug('lastId %s not found send all packets', lastId);
                    list.forEach(function (packet) {
                        var jsonPacket = JSON.parse(packet);
                        if (jsonPacket.timestampValid > now) {
                            emitPacket(socket, jsonPacket)
                        }
                    });
                }
            }
        });
    }
};

function emitPacket(socket, packet) {
    var event = packet.event;
    delete packet.event;
    delete packet.timestampValid;
    debug("emitPacket %s %j", event, packet);
    if (socket.version > 1 && event == 'push') {
        if (packet.data) {
            packet.data = new Buffer(packet.data, "base64");
        }
        packet = msgpack.encode(packet);
    }
    socket.emit(event, packet);
}