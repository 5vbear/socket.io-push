Push-Server
=======================
对外服务

##install & run

* 安装 redis 并修改config.js

```
#config.js

var config = {};

config.apn = {
  production : true
};

config.redis = {
  host : "localhost",
  port : 6379
};

#实例1的websocket端口
config.io_1 = {
  port : 9101
};

#实例1的rest_api端口
config.api_1 = {
  port : 9102
};

config.io_2 = {
  port : 9201
};

config.api_2 = {
  port : 9202
};

config.io_3 = {
  port : 9301
};

config.api_3 = {
  port : 9302
};

module.exports = config;

```


* install nodejs

```
sudo apt-get update
curl -sL https://deb.nodesource.com/setup | sudo bash -
sudo apt-get install -y nodejs
#sudo apt-get install -y npm
sudo npm install -g n
sudo n stable
```

* install node modules

```
npm install
```

* run

```
#前台运行
node . 

#前台运行,开启debug日志
./debug.sh

#后台运行 ,3为运行的实例数
./restart 3


```
##Nginx reverse proxy

nginx.conf
```
upstream ws_backend {
    ip_hash;
    server 127.0.0.1:9101;
    server 127.0.0.1:9201;
    server 127.0.0.1:9301;
}

upstream ws_api {
    ip_hash;
    server 127.0.0.1:9102;
    server 127.0.0.1:9202;
    server 127.0.0.1:9302;
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

* 应用内透传 Push, 根据客户端生成的pushId,推送给一个或多个客户端

```
//推送给abc,def两个客户端.透传数据为字符串hello world (base64 aGVsbG8gd29ybGQ),到topic=/topic/test

http://183.61.6.33/api/push?pushId=abc&pushId=def&data=aGVsbG8gd29ybGQ&topic=/topic/test

data -> base64编码的二进制数据

topic -> 客户端订阅的topic, (subscribe,subscribeBroadcast皆可收到)

pushId -> 客户端生成的随机ID

```

* 应用内透传 Push, 根据客户端生成的pushId,推送给所有订阅的客户端

```
//推送给abc,def两个客户端.透传数据为字符串hello world (base64 aGVsbG8gd29ybGQ),到topic=/topic/test

http://183.61.6.33/api/push?pushAll=true&data=aGVsbG8gd29ybGQ&topic=/topic/test

data -> base64编码的二进制数据

topic -> 客户端订阅的topic, (subscribeBroadcast的才能收到)

pushAll -> true

```

* 状态栏通知api 单个推送

http://183.61.6.33/api/notification?pushId=abc&notification=%7B%20%22android%22%3A%7B%22title%22%3A%22title%22%2C%22message%22%3A%22message%22%7D%2C%22apn%22%3A%7B%22alert%22%3A%22message%22%20%2C%20%22badge%22%3A5%2C%20%22sound%22%3A%22default%22%2C%20%22payload%22%3A1234%7D%7D

pushId -> 客户端生成的随机ID

notification -> 通知消息内容 需要url encode

```
{
  "android" : {"title":"title","message":"message" , "payload" : {"abc":123} },
  "apn":  {"alert":"message" , "badge":5, "sound":"default", "payload":{"abc":123} }
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


* 状态栏通知api 全网推送

http://183.61.6.33/api/notification?pushId=true&notification=%7B%20%22android%22%3A%7B%22title%22%3A%22title%22%2C%22message%22%3A%22message%22%7D%2C%22apn%22%3A%7B%22alert%22%3A%22message%22%20%2C%20%22badge%22%3A5%2C%20%22sound%22%3A%22default%22%2C%20%22payload%22%3A1234%7D%7D

pushAll -> true

notification -> 通知消息内容 需要url encode

```
{
  "android" : {"title":"title","message":"message" , "payload" : {"abc":123} },
  "apn":  {"alert":"message" , "badge":5, "sound":"default", "payload":{"abc":123} }
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