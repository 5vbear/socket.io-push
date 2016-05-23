Push-Server
=======================
对外服务

##install & run

* 安装/更新
sudo npm install -g socket.io-push

* 新建工作目录

mkdir push-server    
cd push-server

* 新建config.js

```
var config = {};

config.pingTimeout = 25000;  //心跳间隔
config.pingInterval = 25000;
config.apns = [];

config.redis = {
    masters: [
        {
            host: "127.0.0.1",
            port: 6379
        }
    ]
};

config.io_port = 10001;
config.api_port = 11001;

module.exports = config;
```

#运行
push-server -v -f    
-v verbose   
-f foreground   
-d debug     
-c 起的进程数

#后台地址
http://yourip:10001/

#websocket地址
http://yourip:11001/

##Nginx reverse proxy

nginx.conf

```
upstream ws_backend {
    ip_hash;
    server 127.0.0.1:11001;
    server 127.0.0.1:11002;
    server 127.0.0.1:11003;
}

upstream ws_api {
    ip_hash;
    server 127.0.0.1:12001;
    server 127.0.0.1:12002;
    server 127.0.0.1:12003;
}

server
{
    listen 80;

    location / {
        proxy_pass http://ws_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Host $host;
        proxy_set_header Connection "upgrade";
    }
    
    location /api {
        proxy_pass ws_api;
    }
}
```

##HTTP API

string[]类型,表示http协议中list类型参数，如 get?uid=123&uid=456 ,表示一个uid数组 ["123", "456"]. get?uid=123 表示单个uid数组 [123]

### /api/push 应用内透传

//推送给abc,def两个客户端.透传数据为字符串hello world (base64 aGVsbG8gd29ybGQ),到topic=/topic/test

http://yourip:11001/api/push?pushAll=true&data=aGVsbG8gd29ybGQ&topic=/topic/test

--- 以下参数3选一,指定推送对象

topic -> string, 客户端订阅的topic, (subscribeBroadcast的才能收到)

pushId -> string[], 如 ["abc","def"] 客户端生成的随机ID,单个或者数组

uid -> string[],如 ["123","456"] 通过addPushIdToUid接口绑定的uid

---

json ->  以下类型三选一,透传给客户端的数据,客户端会在onPush里接收到

         string "test string" (如要使用其他协议,如protobuf,可以使用base64 encoded string)

         json map  {"uri":1, content:"test string"}

         json array  [1, {"content":"test string"}] 
         
         一般业务建议使用json数组(省流量)
         
         第一个int或string来表示推送类型,第二个参数表示该类型的透传数据


### /api/notification 状态栏通知api

http://yourip:11001/api/notification?pushId=true&notification=%7B%20%22android%22%3A%7B%22title%22%3A%22title%22%2C%22message%22%3A%22message%22%7D%2C%22apn%22%3A%7B%22alert%22%3A%22message%22%20%2C%20%22badge%22%3A5%2C%20%22sound%22%3A%22default%22%2C%20%22payload%22%3A1234%7D%7D

--- 以下参数3选一,指定推送对象

pushAll -> string, true表示推送全网,其它或者留空表示单个推送

pushId -> string[], 如 ["abc","def"] 客户端生成的随机ID,单个或者数组

uid -> string[],如 ["123","456"] 通过addPushIdToUid接口绑定的uid

---

notification -> 通知消息内容 需要url encode

```
{
  "android" : {"title":"title","message":"message" },
  "apn":  {"alert":"message" , "badge":5, "sound":"default" },
  "payload": { "abc": 123}
}
```

notification是一个json map,内容说明如下

android - 推送给安卓手机的通知内容

apn - 通过apns推送给ios手机的通知内容

title & message - 安卓通知栏的消息标题和内容

alert(ios) - (apn对应的alert字段)消息内容

badge(ios) - (apn对应的badge字段) 可选

sound(ios) - (apn对应的sound字段) 可选

payload - 发送给应用非显示用的透传信息, 需要是一个json map


### /api/uid/add 绑定UID和pushId

http://yourip:11001/api/uid/add?pushId=abc&uid=123

pushId -> string,客户端生成的随机ID

uid -> string,服务器需要绑定的UID

### /api/uid/remove 解除pushId的绑定

http://yourip:11001/api/uid/remove?pushId=abc

pushId -> string,客户端生成的随机ID
