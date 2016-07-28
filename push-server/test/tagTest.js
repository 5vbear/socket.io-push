var chai = require('chai');
var request = require('superagent');

var expect = chai.expect;

describe('tag', function () {

    before(function () {
        global.pushService = require('../lib/push-server.js')({             proxy: require("../config-proxy"),             api: require("../config-api")         });
        global.apiUrl = 'http://localhost:' + pushService.api.port;
        global.pushClient = require('socket.io-push-client')('http://localhost:' + pushService.proxy.port, {
            transports: ['websocket', 'polling'],
            useNotification: true
        });
    });

    after(function () {
        global.pushService.close();
        global.pushClient.disconnect();
    });

    it('add tag', function (done) {
        pushClient.on("connect", function () {
            pushClient.addTag("tag1");
            pushClient.addTag("tag2");
            setTimeout(function () {
                global.pushService.api.tagService.getTagsByPushId(pushClient.pushId, function (tags) {
                    expect(tags).to.deep.include.members(["tag1"]);
                    global.pushService.api.tagService.getPushIdsByTag("tag1", function (pushIds) {
                        expect(pushIds).to.deep.include.members([pushClient.pushId]);
                        done();
                    });
                });
            }, 100);
        });
    });

    it('remove tag', function (done) {
        pushClient.removeTag("tag1");
        setTimeout(function () {
            global.pushService.api.tagService.getTagsByPushId(pushClient.pushId, function (tags) {
                expect(tags).to.not.deep.include.members(["tag1"]);
                global.pushService.api.tagService.getPushIdsByTag("tag1", function (pushIds) {
                    expect(pushIds).to.not.deep.include.members([pushClient.pushId]);
                    done();
                });
            });
        }, 100);
    });

    it('tag connect callback', function (done) {
        pushClient.on("connect", function (data) {
            expect(['tag2']).to.deep.equal(data.tags);
            done();
        });
        pushClient.disconnect();
        pushClient.connect();
    });

    it('notification remote', function (done) {
        var title = 'hello',
            message = 'hello world';
        var data = {
            "android": {"title": title, "message": message}
        }
        var str = JSON.stringify(data);

        var notificationCallback = function (data) {
            expect(data.title).to.be.equal(title);
            expect(data.message).to.be.equal(message);
            done();
        }
        pushClient.on('notification', notificationCallback);

        request
            .post(apiUrl + '/api/notification')
            .send({
                tag: 'tag2',
                notification: str
            })
            .set('Accept', 'application/json')
            .end(function (err, res) {
                expect(res.text).to.be.equal('{"code":"success"}');
            });
    });

    it('notification no remote', function (done) {
        pushService.api.apiRouter.remoteUrls = null;
        var title = 'hello 2',
            message = 'hello world 2';
        var data = {
            "android": {"title": title, "message": message}
        }
        var str = JSON.stringify(data);

        var notificationCallback = function (data) {
            expect(data.title).to.be.equal(title);
            expect(data.message).to.be.equal(message);
            done();
        }
        pushClient.on('notification', notificationCallback);

        request
            .post(apiUrl + '/api/notification')
            .send({
                tag: 'tag2',
                notification: str
            })
            .set('Accept', 'application/json')
            .end(function (err, res) {
                expect(res.text).to.be.equal('{"code":"success"}');
            });
    });

});
