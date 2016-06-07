var redis = require('redis');
var redisClient = redis.createClient();

redisClient.on("error", function (error) {
    console.log(error);
});

var mSecPerHour = 60 * 60 * 1000;

function hourStrip(timestamp) {
    return Math.ceil(timestamp / mSecPerHour) * mSecPerHour;
}
var connectTotal, connectCount, pushTotal, pushCount, notificationTotal, notificationCount;

exports.handleResult = function (result) {
    var timestamp = Date.now();
    connectTotal = 0;
    connectCount = 0;
    pushCount = 0;
    notificationCount = 0;
    pushTotal = 0;
    notificationTotal = 0;

    var onces = [];
    for (var i = 0; i < result.length; i++) {
        if (result[i].title.type === 'connect') {
            if (onces.length > 0) {
                countData(onces, timestamp);
                onces = [];
            }
        }
        onces.push(result[i]);
        if (i == result.length - 1) {
            countData(onces, timestamp);
        }
    }

    console.log("connectTotal:" + connectTotal, "connectCount:" + connectCount, "pushTotal:" + pushTotal, "pushCount:" + pushCount, 'notificationTotal:' + notificationTotal, 'notificationCount:' + notificationCount);
    redisClient.hset("queryDataKeys", 'monitor:ConnectPush', Date.now())
    redisClient.incrby("stats#monitor:ConnectPush#successCount#" + hourStrip(timestamp), connectCount);
    redisClient.incrby("stats#monitor:ConnectPush#totalCount#" + hourStrip(timestamp), connectTotal);

}

function countData(onces, timestamp) {
    connectTotal++;
    var isConnect = false;
    for (var i = 0; i < onces.length; i++) {
        if (onces[i].title.type === 'connect' && onces[i].state === 'passed') {
            connectCount++;
            isConnect = true;
            redisClient.incrby("stats#monitor:ConnectPush#totalLatency#" + hourStrip(timestamp), onces[i].duration);
        }
    }
}

exports.client = redisClient;
