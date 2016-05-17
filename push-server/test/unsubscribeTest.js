var request = require('superagent');

var chai = require('chai');

var expect = chai.expect;

describe('unsubscribe test', function () {

    before(function () {
        var config = require('../config.js');
        global.pushService = require('../lib/push-server.js')(config);
        global.apiUrl = 'http://localhost:' + config.api_port;
        global.pushClient = require('../lib/client/push-client.js')('http://localhost:' + config.io_port);

    });

    after(function () {
        global.pushService.close();
        global.pushClient.disconnect();
    });

    it('connect', function (done) {
        pushClient.on('connect', function (data) {
            expect(data.pushId).to.be.equal(pushClient.pushId);
            done();
        });

    });


    it('push to topic', function (done) {
        var json = '{ "message":"ok"}';

        var i = 0;
        pushClient.subscribeTopic("message");
        pushClient.on('push', function (data) {
            expect(i++ == 0);
            expect(data.message).to.be.equal('ok');
            pushClient.unsubscribeTopic("message");
            request
                .post(apiUrl + '/api/push')
                .send({
                    topic: 'message',
                    json: json
                })
                .set('Accept', 'application/json')
                .end(function (err, res) {
                    expect(res.text).to.be.equal('{"code":"success"}');
                    setTimeout(function () {
                        done();
                    }, 100);
                });
        });
        request
            .post(apiUrl + '/api/push')
            .send({
                topic: 'message',
                json: json
            })
            .set('Accept', 'application/json')
            .end(function (err, res) {
                expect(res.text).to.be.equal('{"code":"success"}');
            });
    });

});
