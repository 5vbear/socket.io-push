module.exports = UidStore;
var logger = require('../log/index.js')('UidStore');

function UidStore(redis, subClient) {
    if (!(this instanceof UidStore)) return new UidStore(redis, subClient);
    this.redis = redis;
}

UidStore.prototype.addUid = function (pushId, uid, timeToLive) {
    logger.debug("addUid pushId %s %s", uid, pushId);
    var key = "pushIdToUid#" + pushId;
    var self = this;
    this.getUidByPushId(pushId, function (oldUid) {
        if (oldUid) {
            logger.debug("remove %s from old uid %s", pushId, oldUid);
            self.redis.hdel("uidToPushId#" + oldUid, pushId);
        }
        self.redis.set(key, uid);
        if (timeToLive) {
            self.redis.expire(key, timeToLive);
        }
        self.redis.hset("uidToPushId#" + uid, pushId, Date.now());
    });
};

UidStore.prototype.removePushId = function (pushId) {
    logger.debug("removePushId pushId  %s", pushId);
    var key = "pushIdToUid#" + pushId;
    var self = this;
    this.redis.get(key, function (err, oldUid) {
        if (oldUid) {
            logger.debug("remove %s from old uid %s", pushId, oldUid);
            self.redis.hdel("uidToPushId#" + oldUid, pushId);
            self.redis.del(key);
        }
    });
};

UidStore.prototype.getUidByPushId = function (pushId, callback) {
    this.redis.get("pushIdToUid#" + pushId, function (err, uid) {
        // reply is null when the key is missing
        logger.debug("getUidByPushId %s %s", pushId, uid);
        callback(uid);
    });
};

UidStore.prototype.getPushIdByUid = function (uid, callback) {
    this.redis.hkeys("uidToPushId#" + uid, function (err, replies) {
        if (replies && replies.length > 0) {
            callback(replies);
        }
    });
};
