module.exports = (httpServer, spdyServer, apiRouter, topicOnline, stats, config, apnService, apiAuth, uidStore, connectService, arrivalStats) => {
  return new RestApi(httpServer, spdyServer, apiRouter, topicOnline, stats, config, apnService, apiAuth, uidStore, connectService, arrivalStats);
};
const express = require('express');
const logger = require('winston-proxy')('RestApi');
const async = require('async');
const request = require('request');

class RestApi {

  constructor(httpServer, spdyServer, apiRouter, topicOnline, stats, config, apnService, apiAuth = (opts, callback) => {
    callback(true)
  }, uidStore, connectService, arrivalStats) {
    this.apiAuth = apiAuth;
    this.apiRouter = apiRouter;

    const app = express();
    var bodyParser = require('body-parser');
    app.use("/api", bodyParser.urlencoded({ // to support URL-encoded bodies
      extended: true
    }));
    app.use("/api", bodyParser.json());
    app.use("/api", (req, res, next) => {
      req.p = {};
      for (const param in req.body) {
        req.p[param] = req.body[param];
      }
      for (const param in req.query) {
        req.p[param] = req.query[param];
      }
      res.set("Access-Control-Allow-Origin", "*");

      this.apiAuth({
        req,
        logger,
        request
      }, (pass, message) => {
        if (!pass) {
          logger.error("api denied ", req.originalUrl, req.connection.remoteAddress);
          res.statusCode = 401;
          res.json({
            code: "error",
            message: message || 'apiAuth check fail'
          });
        }
        return next();
      });

    });

    if (httpServer) {
      this.httpServer = httpServer;
      httpServer.on('request', app);
    }
    if (spdyServer) {
      this.spdyServer = spdyServer;
      spdyServer.on('request', app);
    }
    const router = express.Router();
    app.use("/api", router);

    router.all('/push', (req, res, next) => {
      if (!req.p.topic && !req.p.pushId && !req.p.uid) {
        res.statusCode = 400;
        res.json({
          code: "error",
          message: 'topic or pushId or uid is required'
        });
        return next();
      }

      const data = req.p.data;
      const json = req.p.json;
      if (!data && !json) {
        res.statusCode = 400;
        res.json({
          code: "error",
          message: 'data is required'
        });
        return next();
      }
      logger.info("handlePush %j", req.p);
      const pushData = {};
      if (data) {
        pushData.data = data;
      }
      if (json) {
        try {
          pushData.j = JSON.parse(json);
        } catch (err) {
          pushData.j = json;
        }
      }

      const pushIds = this.parseArrayParam(req.p.pushId);
      const uids = this.parseArrayParam(req.p.uid);

      if (!pushIds && !uids && !req.p.topic) {
        res.statusCode = 400;
        res.json({
          code: "error",
          message: "pushId or uid or topic is required"
        });
        return next();
      }

      if (this.moreThanOneTrue(pushIds, uids, req.p.topic)) {
        res.statusCode = 400;
        res.json({
          code: "error",
          message: "pushId or uid or topic can't be present at the same time"
        });
        return next();
      }

      apiRouter.push(pushData, req.p.topic, pushIds, uids, this.parseNumber(req.p.timeToLive));
      res.json({
        code: "success"
      });
      return next();

    });

    router.all('/notification', (req, res, next) => {
      logger.info("handleNotification %j", req.connection.remoteAddress, req.p);

      if (!req.p.notification) {
        res.statusCode = 400;
        res.json({
          code: "error",
          message: 'notification is required'
        });
        return next();
      }

      let notification;

      if (typeof req.p.notification == "string") {
        try {
          notification = JSON.parse(req.p.notification);
        } catch (err) {
          logger.error("notification parse json error ", req.p.notification, err);
          res.statusCode = 400;
          res.json({
            code: "error",
            message: 'notification format error ' + err + " " + req.p.notification
          });
          return next();
        }
      } else {
        notification = req.p.notification;
      }

      if (!notification.android) {
        notification.android = {};
      }

      if (notification.payload) {
        notification.android.payload = notification.payload;
        delete notification.payload;
      }

      if (!notification.android.payload) {
        notification.android.payload = {};
      }

      if (notification.apn && notification.apn.payload) {
        delete notification.apn.payload;
      }

      const pushIds = this.parseArrayParam(req.p.pushId);
      const uids = this.parseArrayParam(req.p.uid);

      if (req.p.pushAll == 'true') {
        logger.info('handleNotification pushAll ', req.p);
      }

      if (!req.p.tag && !pushIds && !uids && req.p.pushAll != 'true') {
        res.statusCode = 400;
        res.json({
          code: "error",
          message: "pushId / uid / tag is required"
        });
        return next();
      }

      if (this.moreThanOneTrue(req.p.tag, pushIds, uids, req.p.pushAll == 'true')) {
        res.statusCode = 400;
        res.json({
          code: "error",
          message: "tag / pushId / pushAll can't be present at the same time"
        });
        return next();
      }

      const id = apiRouter.notification(notification, req.p.pushAll == 'true', pushIds, uids, req.p.tag, this.parseNumber(req.p.timeToLive));
      res.json({
        code: "success",
        id: id
      });
      return next();
    });

    router.all('/routeNotification', (req, res, next) => {
      const notification = JSON.parse(req.p.notification);
      const pushIds = JSON.parse(req.p.pushId);
      const timeToLive = this.parseNumber(req.p.timeToLive);
      apiRouter.notificationLocal(notification, pushIds, timeToLive);
      res.json({
        code: "success"
      });
      return next();
    });

    router.all('/heapdump', (req, res, next) => {
      var file = process.cwd() + "/" + Date.now() + '.heapsnapshot';
      require('heapdump').writeSnapshot(file);
      res.json({
        code: "success",
        file: file
      });
      return next();
    });

    router.all('/heap', (req, res, next) => {
      const v8 = require('v8');
      res.json({
        code: "success",
        heapStatistics: v8.getHeapStatistics(),
        heapSpaceStatistics: v8.getHeapSpaceStatistics()
      });
      return next();
    });

    router.all('/stats/base', (req, res, next) => {
      stats.getSessionCount((count) => {
        res.json(count);
        return next();
      });
    });

    router.all('/stats/chart', (req, res, next) => {
      const key = req.p.key;
      stats.find(key, (result) => {
        res.json(result);
        return next();
      });
    });

    router.all('/stats/arrival/info', (req, res, next) => {
      const packetId = req.p.id;
      if (packetId) {
        arrivalStats.getArrivalInfo(packetId, (packet) => {
          res.json(packet);
          return next();
        });
      } else {
        res.json({});
        return next();
      }

    });

    router.all('/stats/arrival/:type', (req, res, next) => {
      arrivalStats.getRateStatusByType(req.params.type, (result) => {
        res.json(result);
        return next();
      })
    });

    router.all('/uid/bind', (req, res, next) => {
      uidStore.bindUid(req.p.pushId, req.p.uid, req.p.platform, this.parseNumber(req.p.platformLimit));
      uidStore.publishBindUid(req.p.pushId, req.p.uid);
      res.json({
        code: "success"
      });
      return next();
    });

    router.all('/uid/remove', (req, res, next) => {
      const pushIds = this.parseArrayParam(req.p.pushId);
      const uids = this.parseArrayParam(req.p.uid);
      if (pushIds) {
        pushIds.forEach((pushId) => {
          uidStore.removePushId(pushId, true);
          uidStore.publishUnbindUid(pushId, null);
        });
        res.json({
          code: "success"
        });
      } else if (uids) {
        uids.forEach((uid) => {
          uidStore.removeUid(uid);
          uidStore.publishUnbindUid(null, uid);
        });
        res.json({
          code: "success"
        });
      } else {
        res.statusCode = 400;
        res.json({
          code: "error",
          message: "pushId or uid is required"
        });
      }
      return next();
    });

    router.all('/stats/getQueryDataKeys', (req, res, next) => {
      stats.getQueryDataKeys((result) => {
        logger.debug("getQueryDataKeys result: " + result)
        res.json({
          "result": result
        });
        return next();
      });
    });

    router.all('/apn', (req, res, next) => {
      apnService.callLocal(JSON.parse(req.p.notification), req.p.bundleId, this.parseArrayParam(req.p.tokens), req.p.pattern, (result) => {
        result.code = "success";
        res.json(result);
        return next();
      });
    });

    router.all('/topicOnline', (req, res, next) => {
      const topic = req.p.topic;
      if (!topic) {
        res.statusCode = 400;
        res.json({
          code: 'error',
          message: 'topic is required'
        })
        return next();
      }
      topicOnline.getTopicOnline(topic, (result) => {
        res.json({
          count: result,
          topic: req.p.topic
        });
        return next();
      });
    });

    router.all('/topicDevices', (req, res, next) => {
      const topic = req.p.topic;
      if (!topic) {
        res.statusCode = 400;
        res.json({
          code: 'error',
          message: 'topic is required'
        })
        return next();
      }
      topicOnline.getTopicDevices(topic, (result) => {
        res.json(result);
        return next();
      });
    });

    router.all('/isConnected', (req, res, next) => {
      if (req.p.pushId) {
        const pushId = req.p.pushId;
        connectService.isConnected(pushId, (connected) => {
          uidStore.getUidByPushId(pushId, (uid) => {
            res.json({
              pushId: pushId,
              uid: uid || '',
              connected: connected
            })
            return next();
          });
        })
      } else if (req.p.uid) {
        uidStore.getPlatformByUid(req.p.uid, (reply) => {
          let pushIds = Object.keys(reply);
          let result = [];
          async.each(pushIds, (pushId, callback) => {
            connectService.isConnected(pushId, (connected) => {
              result.push({
                pushId: pushId,
                platform: reply[pushId].split(',')[0],
                connected: connected
              });
              callback();
            })
          }, () => {
            res.json(result);
            return next();
          });
        });
      } else {
        res.statusCode = 400;
        res.json({
          code: 'error',
          message: 'pushId is required'
        });
        return next();
      }
    });
    router.all('/token', (req, res, next) => {
      const pushId = req.p.pushId;
      apiRouter.notificationService.getTokenDataByPushId(pushId, (token) => {
        logger.debug('---- token: ' + token);
        res.json({
          pushId: pushId,
          token: token || ''
        });
        return next();
      });
    });

    router.all('/config', (req, res, next) => {
      res.json(config);
      return next();
    });
  }

  close() {
    if (this.httpServer) {
      this.httpServer.close();
    }
    if (this.spdyServer) {
      this.spdyServer.close();
    }
  }

  moreThanOneTrue() {
    let count = 0;
    for (const item of arguments) {
      if (item) {
        count++;
      }
    }
    return count > 1;
  }

  parseArrayParam(param) {
    let arr;
    if (typeof param === 'string') {
      if (param.startsWith('[')) {
        arr = JSON.parse(param);
      } else if (param) {
        arr = [param];
      }
    } else if (typeof param === 'number') {
      arr = [param];
    } else {
      arr = param;
    }
    return arr;
  }

  parseNumber(param) {
    return parseInt(param) || 0;
  }
}
