var request = require('superagent');

var chai = require('chai');

var expect = chai.expect;

describe('apn test', function () {

    before(function () {
        var config = require('../config.js');
        global.apiUrl = 'http://localhost:' + config.api_port;
        config.apnsSliceServers = [
            apiUrl, apiUrl, apiUrl
        ];
        global.pushService = require('../lib/push-server.js')(config);
        global.pushClient = require('../lib/client/push-client.js')('http://localhost:' + config.io_port);

    });

    after(function () {
        global.pushService.close();
        global.pushClient.disconnect();
    });


    it('test send all', function (done) {
        pushClient.on('connect', function () {
            pushClient.socket.emit("token", {token: "ffffff", bundleId: "com.xuduo.pushtest", type: "apn"});
            var data = {
                "apn": {alert: "wwww"}
            }
            var str = JSON.stringify(data);

            pushClient.on('notification', function () {
                expect("do not receive").to.be.false
            });

            request
                .post(apiUrl + '/api/notification')
                .send({
                    pushAll: 'true',
                    notification: str
                })
                .set('Accept', 'application/json')
                .end(function (err, res) {
                    expect(res.text).to.be.equal('{"code":"success"}');
                    done();
                });
        });

    });

});
