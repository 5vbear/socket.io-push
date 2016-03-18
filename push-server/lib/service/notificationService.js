module.exports = NotificationService;

var debug = require('debug')('NotificationService');
var util = require('../util/util.js');
var apn = require('apn');
var apnTokenTTL = 3600 * 24 * 7;


function NotificationService(apnConfigs, redis, ttlService) {
    if (!(this instanceof NotificationService)) return new NotificationService(apnConfigs, redis, ttlService);
    this.redis = redis;
    this.ttlService = ttlService;
    this.apnConnections = {};
    var outerThis = this;
    var fs = require('fs');
    var ca = [fs.readFileSync(__dirname + "/../../cert/entrust_2048_ca.cer")];

    apnConfigs.forEach(function (apnConfig, index) {
        apnConfig.maxConnections = 5;
        apnConfig.ca = ca;
        apnConfig.errorCallback = function (errorCode, notification, device) {
            var id = device.token.toString('hex');
            debug("apn errorCallback %d %s", errorCode, id);
            if (errorCode == 8) {
                redis.hdel("apnTokens", id);
            }
        }
        var connection = apn.Connection(apnConfig);
        connection.index = index;
        outerThis.apnConnections[apnConfig.bundleId] = connection;
        debug("apnConnections init for %s", apnConfig.bundleId);
    });

    this.bundleIds = Object.keys(this.apnConnections);
    this.defaultBundleId = this.bundleIds[0];
    debug("defaultBundleId %s", this.defaultBundleId);

}

NotificationService.prototype.setApnToken = function (pushId, apnToken, bundleId) {
    if (pushId && apnToken) {
        if (!bundleId) {
            bundleId = this.defaultBundleId;
        }
        var apnData = JSON.stringify({bundleId: bundleId, apnToken: apnToken});
        var outerThis = this;
        this.redis.get("apnTokenToPushId#" + apnToken, function (err, oldPushId) {
            debug("oldPushId %s", oldPushId);
            if (oldPushId && oldPushId != pushId) {
                outerThis.redis.del("pushIdToApnData#" + oldPushId);
                debug("remove old pushId to apnToken %s %s", oldPushId, apnData);
            }
            outerThis.redis.set("apnTokenToPushId#" + apnToken, pushId);
            outerThis.redis.set("pushIdToApnData#" + pushId, apnData);
            outerThis.redis.hset("apnTokens#" + bundleId, apnToken, Date.now());
            outerThis.redis.expire("pushIdToApnData#" + pushId, apnTokenTTL);
            outerThis.redis.expire("apnTokenToPushId#" + apnToken, apnTokenTTL);
        });
    }
};

NotificationService.prototype.sendByPushIds = function (pushIds, timeToLive, notification, io) {
    var outerThis = this;
    pushIds.forEach(function (pushId) {
        outerThis.redis.get("pushIdToApnData#" + pushId, function (err, reply) {
            debug("pushIdToApnData " + reply);
            if (reply) {
                var apnData = JSON.parse(reply);
                var bundleId = apnData.bundleId;
                var apnConnection = outerThis.apnConnections[bundleId];
                if (apnConnection) {
                    var note = toApnNotification(notification, timeToLive);
                    apnConnection.pushNotification(note, apnData.apnToken);
                    debug("send to notification to ios %s %s", pushId, apnData.apnToken);
                }
            } else {
                debug("send to notification to android %s", pushId);
                outerThis.ttlService.addPacketAndEmit(pushId, 'noti', timeToLive, notification, io, true);
            }

        });
    });

};

NotificationService.prototype.sendAll = function (notification, timeToLive, io) {
    this.ttlService.addPacketAndEmit("noti", 'noti', timeToLive, notification, io, false);
    var apnConnections = this.apnConnections;
    var timestamp = Date.now();
    var redis = this.redis;
    var note = toApnNotification(notification, timeToLive);
    this.bundleIds.forEach(function (bundleId) {
        redis.hgetall("apnTokens#" + bundleId, function (err, replies) {
            if (replies) {
                var tokens = [];
                for (var token in replies) {
                    if (timestamp - replies[token] > apnTokenTTL * 1000) {
                        debug("delete outdated apnToken %s", token);
                        redis.hdel("apnTokens#" + bundleId, token);
                    } else {
                        tokens.push(token);
                    }
                }
                if (tokens.length > 0) {
                    var apnConnection = apnConnections[bundleId];
                    debug("bundleId %s replies %d", bundleId, tokens.length);
                    apnConnection.pushNotification(note, tokens);
                }
            }
        });
    });

};

function toApnNotification(notification, timeToLive) {
    var note = new apn.Notification();
    note.badge = notification.apn.badge;
    if (notification.apn.sound) {
        note.sound = notification.apn.sound;
    } else {
        note.sound = "default";
    }
    note.alert = notification.apn.alert;
    var secondsToLive;
    if (timeToLive > 0) {
        secondsToLive = timeToLive / 1000;
    } else {
        secondsToLive = 600;
    }
    note.expiry = Math.floor(Date.now() / 1000) + secondsToLive;
    if (notification.apn.payload) {
        note.payload = notification.apn.payload;
    } else {
        note.payload = {};
    }
    return note;
}