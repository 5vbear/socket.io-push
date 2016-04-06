module.exports = ProxyServer;
var logger = require('../log/index.js')('ProxyServer');
var http = require('http');

function ProxyServer(io, stats, packetService, notificationService, ttlService) {
    this.io = io;

    io.on('connection', function (socket) {

        socket.version = 0;

        socket.on('disconnect', function () {
            stats.removeSession();
            stats.removePlatformSession(socket.platform);
            if (socket.pushId) {
                logger.debug( "publishDisconnect %s", socket.pushId);
                packetService.publishDisconnect(socket);
            }
        });

        var oldPacket = socket.packet;
        socket.packet = function (packet, preEncoded) {
            if (stats.shouldDrop()) {
                return;
            }
            stats.onPacket();
            oldPacket.call(socket, packet, preEncoded);
        }

        socket.on('pushId', function (data) {
            if (data.id && data.id.length >= 10) {
                logger.debug( "on pushId %j", data);
                if (data.platform) {
                    socket.platform = data.platform.toLowerCase();
                }
                stats.addPlatformSession(socket.platform);
                var topics = data.topics;
                if (data.version) {
                    socket.version = data.version;
                }
                if (topics && topics.length > 0) {
                    topics.forEach(function (topic) {
                        socket.join(topic);
                    });
                }
                var lastPacketIds = data.lastPacketIds;
                if (lastPacketIds) {
                    for (var topic in lastPacketIds) {
                        ttlService.getPackets(topic, lastPacketIds[topic], socket);
                    }
                }
                if (data.lastUnicastId) {
                    ttlService.getPackets(data.id, data.lastUnicastId, socket);
                }

                var reply = {id: data.id};
                socket.pushId = data.id;
                packetService.publishConnect(socket);
                socket.join(data.id);
                socket.emit('pushId', reply);
                logger.debug( 'join room socket.id %s ,pushId %s', socket.id, socket.pushId);
                ttlService.onPushId(socket);
            }
        });

        socket.on('subscribeTopic', function (data) {
            var topic = data.topic;
            ttlService.getPackets(topic, data.lastPacketId, socket);
            socket.join(topic);
        });


        socket.on('unsubscribeTopic', function (data) {
            logger.debug( "on unsubscribeTopic %j", data);
            var topic = data.topic;
            socket.leave(topic);
        });

        socket.on('apnToken', function (data) {
            logger.debug( "on apnToken %j", data);
            var pushId = data.pushId;
            var apnToken = data.apnToken;
            notificationService.setApnToken(pushId, apnToken, data.bundleId);
        });

        socket.on('packetProxy', function (data) {
            data.pushId = socket.pushId;
            packetService.publishPacket(data);
        });

        socket.on('notificationReply', function (data) {
            stats.onNotificationReply(data.timestamp);
        });

        stats.addSession(socket);
    });
}

ProxyServer.prototype.getTopicOnline = function (topic) {
    var online = this.io.nsps['/'].adapter.rooms[topic].length;
    logger.debug( "on topic online %s %d", topic, online);
    return online;
}