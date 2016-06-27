var chai = require('chai');

var expect = chai.expect;

describe('http test', function () {

    before(function () {
        global.config = require('../config.js');
        global.pushService = require('../lib/push-server.js')(config);
        global.pushClient = require('../lib/client/push-client.js')('http://localhost:' + config.io_port, {
            transports: ['websocket', 'polling'],
            useNotification: true
        });
    });

    after(function () {
        global.pushService.close();
        global.pushClient.disconnect();
    });

    it('get', function (done) {
        pushClient.on("connect", function () {
            pushClient.http({
                method: "get",
                url: "http://localhost:" + config.api_port + "/api/echo",
                data: {param1: "value1", param2: "value2"}
            }, function (result) {
                expect(result.body.param1).to.be.equal("value1");
                expect(result.statusCode).to.be.equal(200);
                done();
            });
        });

    });

    it('post', function (done) {
        pushClient.http({
            method: "post",
            url: "http://localhost:" + config.api_port + "/api/echo",
            params: {param1: "value1", param2: "value2"}
        }, function (result) {
            expect(result.body.param1).to.be.equal("value1");
            expect(result.statusCode).to.be.equal(200);
            done();
        });
    });

    it('error', function (done) {
        pushClient.http({
            method: "post",
            url: "http://localhost2:" + config.api_port + "/api/echo",
            params: {param1: "value1", param2: "value2"}
        }, function (result) {
            expect(result.statusCode).to.be.equal(0);
            done();
        });
    });

});
