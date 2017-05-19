module.exports = (mongo, topicOnline, xiaomiProvider) => {
  return new ArrivalStats(mongo, topicOnline, xiaomiProvider);
};

const logger = require('winston-proxy')('ArrivalStats');
const async = require('async');

class ArrivalStats {

  constructor(mongo, topicOnline, xiaomiProvider) {
    this.mongo = mongo;
    this.topicOnline = topicOnline;
    this.recordKeepTime = 30 * 24 * 3600 * 1000;
    this.xiaomiProvider = xiaomiProvider;
  }

  addArrivalInfo(msgId, inc, set = {}) {
    const data = {};
    if (Object.keys(inc).length > 0) {
      data['$inc'] = inc;
    }
    if (Object.keys(set).length > 0) {
      data['$set'] = set;
    }
    this.mongo.arrival.update({
      _id: msgId
    }, data, {
      upsert: true
    }, (err, doc) => {
      logger.debug('addArrivalInfo ', msgId, data, doc, err);
    });
  }

  msgToData(msg, ttl) {
    return {
      notification: msg.message || (msg.apn && msg.apn.alert) || (msg.android && msg.android.message),
      expireAt: Date.now() + this.recordKeepTime,
      timeStart: Date.now(),
      ttl
    };
  }

  addPushAll(msg, ttl) {
    logger.info('addPushAll, packet:%s', msg.id);
    this.topicOnline.getTopicOnline('noti', (count) => {
      logger.info('packet(%s) init count:%d', msg.id, count);
      const data = this.msgToData(msg, ttl);
      data.type = 'pushAll';
      this.addArrivalInfo(msg.id, {
        'target_android': count
      }, data);
    });
  }

  addPushMany(msg, ttl, sentCount) {
    logger.info('addPushMany, packet: %s', msg);
    const data = this.msgToData(msg, ttl);
    data.type = 'pushMany';
    this.addArrivalInfo(msg.id, {
      'target_android': sentCount
    }, data);
  }

  getRateStatusByType(type, callback) {
    this.mongo.arrival.find({
        type: type
      })
      .sort({
        'timeStart': -1
      })
      .limit(50)
      .exec((err, docs) => {
        const result = [];
        async.each(docs, (doc, asynccb) => {
          this.calculateArrivalInfo(doc, (info) => {
            if (info) {
              result.push(info);
            }
            asynccb();
          });
        }, (err) => {
          if (err) logger.error('error: ' + err);
          result.sort((l, r) => {
            return new Date(r.timeStart) - new Date(l.timeStart);
          });
          callback(result);
        });
      });
  }

  calculateArrivalInfo(packet, callback) {

    packet.timeValid = new Date(parseInt(packet.timeStart) + parseInt(packet.ttl)).toLocaleString();
    packet.timeStart = new Date(parseInt(packet.timeStart)).toLocaleString();
    let apn = {};
    apn.target = parseInt(packet.target_apn || 0);
    apn.arrive = parseInt(packet.arrive_apn || 0);
    apn.click = parseInt(packet.click_apn || 0);
    apn.arrivalRate = apn.target != 0 ? (apn.arrive * 100 / apn.target).toFixed(2) + '%' : 0;
    apn.clickRate = apn.target != 0 ? (apn.click * 100 / apn.target).toFixed(2) + '%' : 0;
    delete packet.target_apn;
    delete packet.arrive_apn;
    delete packet.click_apn;

    if (apn.target > 0) {
      packet.apn = apn;
    }

    let android = {};
    android.target = parseInt(packet.target_android || 0);
    android.arrive = parseInt(packet.arrive_android || 0);
    android.click = parseInt(packet.click_android || 0);
    android.arrivalRate = android.target != 0 ? (android.arrive * 100 / android.target).toFixed(2) + '%' : 0;
    android.clickRate = android.target != 0 ? (android.click * 100 / android.target).toFixed(2) + '%' : 0;
    delete packet.target_android;
    delete packet.arrive_android;
    delete packet.click_android;

    if (android.target > 0 || android.arrive > 0) {
      packet.android = android;
    }

    if (this.xiaomiProvider) {
      this.xiaomiProvider.trace(packet, () => {
        callback(packet);
      });
    } else {
      callback(packet);
    }
  }

  getArrivalInfo(id, callback) {
    this.mongo.arrival.findById(id, (err, doc) => {
      logger.debug('getArrivalInfo: ', id, doc);
      if (!err && doc) {
        this.calculateArrivalInfo(doc, callback);
      }
    });
  }

}
