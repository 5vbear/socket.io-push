module.exports = TTLService;

var logger = require('../log/index.js')('TTLService');
var randomstring = require("randomstring");

function TTLService(redis) {
    this.redis = redis;
}

TTLService.prototype.onPushId = function (socket, lastPacketId) {
    this.getPackets(socket.pushId, lastPacketId, socket);
}

var maxTllPacketPerTopic = -50;

TTLService.prototype.addPacketAndEmit = function (topic, event, timeToLive, packet, io, unicast) {
    packet.id = randomstring.generate(12);
    if (event == "noti") {
        packet.timestamp = Date.now();
    }
    if (timeToLive > 0) {
        logger.info("addPacket %s %s %s", topic, event, timeToLive);
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
            logger.info("addPacket key %s , %d , %d", listKey, oldTtl, timeToLive);
            redis.rpush(listKey, JSON.stringify(data));
            redis.ltrim(listKey, maxTllPacketPerTopic, -1);
            if (timeToLive > oldTtl) {
                redis.pexpire(listKey, timeToLive);
            }
        });
    }
    io.to(topic).emit(event, packet);
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
                        logger.info("lastFound %s %s", jsonPacket.id, lastId);
                    } else if (lastFound == true && jsonPacket.timestampValid > now) {
                        logger.info("call emitPacket %s %s", jsonPacket.id, lastId);
                        emitPacket(socket, jsonPacket);
                    }
                });

                if (!lastFound) {
                    logger.info('lastId %s not found send all packets', lastId);
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
    logger.info("emitPacket %s %j", event, packet);
    socket.emit(event, packet);
}