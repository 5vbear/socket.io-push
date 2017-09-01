var util = require('../util.js');

var chai = require('chai');
var expect = chai.expect;
var IoRedis = require('ioredis');

describe('util', function() {


  it('getByHash size 0', function(done) {
    var array = [1];
    expect(util.getByHash(array, 'abc')).to.equal(1);
    expect(util.getByHash(array, 'abcd')).to.equal(1);
    done();
  });

  it('getByHash size 10', function(done) {
    var array = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(util.getByHash(array, 'abc')).to.equal(1);
    expect(util.getByHash(array, 'abc')).to.equal(1);
    expect(util.getByHash(array, 'abcdefaaaaaa')).to.equal(2);
    expect(util.getByHash(array, 'abcdefaaaaaa')).to.equal(2);
    expect(util.getByHash(array, 'abc22222')).to.equal(2);
    expect(util.getByHash(array, 'abc22222')).to.equal(2);
    expect(util.getByHash(array, 'defg')).to.equal(5);
    expect(util.getByHash(array, 'defg')).to.equal(5);
    done();
  });

  // it('scanHelper', function (done){
  //     var streamArr = [];
  //     let redis = new IoRedis(6379);
  //     [6379,6380,6381].forEach(function(port){
  //         let redis = new IoRedis(port);
  //         redis.hset('scanHelperTest', ''+port, "");
  //         streamArr.push(redis.hscanStream('scanHelperTest', {}));
  //     });
  //     var stream = util.scanHelper(streamArr);
  //     var fields = [];
  //     stream.on('data', function(result){
  //         fields.push(result[0]);
  //         if(fields.length == 3){
  //             done();
  //         }
  //     });
  //     stream.on('end', function(){
  //     })
  // });

});
