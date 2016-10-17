module.exports = TopicOnline;

function filterTopic(topic, filterArray) {
    if (!filterArray || !topic) {
        return false;
    }
    for (let i = 0; i < filterArray.length; i++) {
        if (topic.startsWith(filterArray[i])) {
            return true;
        }
    }
    return false;
}

function TopicOnline(redis, io, id, filterTopics) {
    if (!(this instanceof TopicOnline)) return new TopicOnline(redis, io, id, filterTopics);
    this.redis = redis;
    this.id = id;
    this.filters = filterTopics;
    this.interval = 10000;
    this.timeValidWithIn = 20000;
    this.expire = 3600 * 24;
    if (io) {
        this.io = io;
        setInterval(() => {
            if (this.io.nsps) {
                const result = this.io.nsps['/'].adapter.rooms;
                this.writeTopicOnline(result);
            }
        }, this.interval);
    }
}

TopicOnline.prototype.writeTopicOnline = function (data) {
    for (const key in data) {
        if (data[key].length > 0 && filterTopic(key, this.filters)) {
            const devices = [];
            for (const socketId in data[key].sockets) {
                const socket = this.io.sockets.connected[socketId];
                if (socket) {
                    devices.push({pushId: socket.pushId, uid: socket.uid});
                }
            }
            const json = {length: data[key].length, devices: devices, time: Date.now(),};
            const redisKey = "stats#topicOnline#" + key;
            this.redis.hset(redisKey, this.id, JSON.stringify(json));
            this.redis.expire(redisKey, this.expire);
        }
    }
}

TopicOnline.prototype.getTopicOnline = function (topic, callback) {
    let count = 0;
    const self = this;
    this.redis.hgetall("stats#topicOnline#" + topic, function (err, result) {
        if (result) {
            const delKey = [];
            for (const key in result) {
                const data = JSON.parse(result[key]);
                if ((data.time + self.timeValidWithIn) < Date.now()) {
                    delKey.push(key);
                } else {
                    count = count + data.length;
                }
            }
            if (delKey.length > 0) {
                self.redis.hdel("stats#topicOnline#" + topic, delKey);
            }
        }
        callback(count);
    });
}

TopicOnline.prototype.getTopicDevices = function (topic, callback) {
    const self = this;
    const devices = [];
    this.redis.hgetall("stats#topicOnline#" + topic, function (err, result) {
        if (result) {
            const delKey = [];
            for (const key in result) {
                const data = JSON.parse(result[key]);
                if ((data.time + self.timeValidWithIn) < Date.now()) {
                    delKey.push(key);
                } else {
                    Array.prototype.push.apply(devices, data.devices);
                }
            }
            if (delKey.length > 0) {
                self.redis.hdel("stats#topicOnline#" + topic, delKey);
            }
        }
        callback(devices);
    });
}