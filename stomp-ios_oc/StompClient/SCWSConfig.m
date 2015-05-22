//
//  SCWSConfig.m
//  StompClient
//
//  Created by crazylhf on 15/4/15.
//  Copyright (c) 2015年 yy. All rights reserved.
//

#import "SCWSConfig.h"

#define ServerReplyTimeoutTips          @"请求服务器超时!"
#define ServerConnectFailedTips         @"请求服务器超时!"
#define ServerResDataParseFailedTips    @"解析服务器数据失败!"

@implementation SCWSConfig

- (id)init {
    if (self = [super init]) {
        self.mode                 = SCWSConfigMode_LOCAL;
        self.timeout              = 1;
        self.isDataAsBody         = NO;
        self.timeoutTips          = ServerReplyTimeoutTips;
        self.connectFailTips      = ServerConnectFailedTips;
        self.resDataParseFailTips = ServerResDataParseFailedTips;
    }
    return self;
}

- (id)initWithMode:(SCWSConfigMode)mode {
    if (self = [self init]) {
        self.mode = mode;
    }
    return self;
}

@end
