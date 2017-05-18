var request = require('request');
var chai = require('chai');
var expect = chai.expect;
var defSetting = require('./defaultSetting');

describe('apiAuth.js', () => {

  before(() => {
    global.apiServer = defSetting.getDefaultApiServer();
    global.apiUrl = defSetting.getDefaultApiUrl();
  });

  after(() => {
    global.apiServer.close();
  });

  it('check should pass', done => {
    request({
      url: apiUrl + '/api/push',
      method: "post",
      form: {
        pushId: '',
        pushAll: 'true',
        topic: 'message',
        data: 'test'
      }
    }, (error, response, body) => {
      expect(JSON.parse(body).code).to.be.equal("success");
      done();
    });
  });

  it('check should not pass', (done) => {

    const apiCheckDenyAll = (opts, callback) => {
      callback(false);
    };

    apiServer.restApi.apiAuth = apiCheckDenyAll;

    request({
      url: apiUrl + '/api/push',
      method: "post",
      form: {
        pushId: '',
        pushAll: 'true',
        topic: 'message',
        data: 'test'
      }
    }, (error, response, body) => {
      expect(JSON.parse(body).code).to.be.equal("error");
      request({
        url: apiUrl + '/api/notification',
        method: "post",
        form: {
          pushId: '',
          pushAll: 'true',
          topic: 'message',
          data: 'test'
        }
      }, (error, response) => {
        expect(JSON.parse(response.body).code).to.be.equal("error");
        done();
      });
    });
  });


  it('check ip', (done) => {

    var ipList = ['127.0.0.1', '127.0.0.2'];
    var apiCheckIp = (opts, callback) => {
      var ip = opts.req.headers['x-real-ip'] || opts.req.connection.remoteAddress;
      opts.logger.debug("caller ip %s", ip);
      if (opts.req.p.pushAll == 'true') {
        callback(ipList.indexOf(ip) != -1);
      } else {
        callback(true);
      }
    };

    apiServer.restApi.apiAuth = apiCheckIp;

    request({
      url: apiUrl + '/api/push',
      method: "post",
      form: {
        pushId: '',
        pushAll: 'true',
        data: 'test'
      }
    }, (error, response, body) => {
      expect(JSON.parse(body).code).to.be.equal("error");
    });

    request({
      url: apiUrl + '/api/push',
      method: "post",
      form: {
        pushId: 'test',
        data: 'test'
      }
    }, (error, response, body) => {
      expect(JSON.parse(body).code).to.be.equal("success");
    });


    request({
      url: apiUrl + '/api/push',
      method: "post",
      headers: {
        'X-Real-IP': '127.0.0.2'
      },
      form: {
        pushId: '',
        topic: 'message',
        data: 'test'
      }
    }, (error, response, body) => {
      expect(JSON.parse(body).code).to.be.equal("success");
      done();
    });
  });

});
