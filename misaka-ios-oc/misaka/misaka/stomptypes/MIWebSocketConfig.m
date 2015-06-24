//
//  MIWebSocketConfig.m
//  huwai
//
//  Created by crazylhf on 15/4/15.
//  Copyright (c) 2015年 zq. All rights reserved.
//

#import "MIWebSocketConfig.h"

#define ServerReplyTimeoutTips          @"请求服务器超时!"
#define ServerConnectFailedTips         @"请求服务器超时!"
#define ServerResDataParseFailedTips    @"解析服务器数据失败!"

@implementation MIWebSocketConfig

- (id)init {
    if (self = [super init]) {
        self.mode                 = MIWSConfigMode_LOCAL;
        self.timeout              = 1;
        self.isDataAsBody         = NO;
        self.timeoutTips          = ServerReplyTimeoutTips;
        self.connectFailTips      = ServerConnectFailedTips;
        self.resDataParseFailTips = ServerResDataParseFailedTips;
    }
    return self;
}

- (id)initWithMode:(MIWSConfigMode)mode {
    if (self = [self init]) {
        self.mode = mode;
    }
    return self;
}

@end
