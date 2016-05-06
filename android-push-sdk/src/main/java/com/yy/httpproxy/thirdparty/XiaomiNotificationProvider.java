package com.yy.httpproxy.thirdparty;

import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.util.Log;

import com.xiaomi.channel.commonutils.logger.LoggerInterface;
import com.xiaomi.mipush.sdk.Logger;
import com.xiaomi.mipush.sdk.MiPushClient;
import com.yy.httpproxy.service.ConnectionService;

public class XiaomiNotificationProvider implements NotificationProvider {

    public final static String TAG = "XiaomiProvider";
    private String token;

    public XiaomiNotificationProvider(Context context) {

        String appId = "2882303761517467652";
        String appKey = "5981746732652";
//        String appId = getMetaDataValue(context, "APP_ID");
//        String appKey = getMetaDataValue(context, "APP_KEY");
        String token = MiPushClient.getRegId(context);
        Log.d(TAG, appId + " " + appKey + " token " + token);
        MiPushClient.registerPush(context, appId, appKey);

        LoggerInterface newLogger = new LoggerInterface() {

            @Override
            public void setTag(String tag) {
                // ignore
            }

            @Override
            public void log(String content, Throwable t) {
                Log.d(TAG, content, t);
            }

            @Override
            public void log(String content) {
                Log.d(TAG, content);
            }
        };
        Logger.setLogger(context, newLogger);
        Log.d(TAG, "init");
    }

    @Override
    public String getToken() {
        return token;
    }

    @Override
    public String getType() {
        return "xiaomi";
    }

    @Override
    public void setToken(String token) {
        this.token = token;
    }

    private static String getMetaDataValue(Context context, String metaDataName) {
        String appConfig = null;
        try {
            ComponentName cn = new ComponentName(context, ConnectionService.class);
            ServiceInfo info = context.getPackageManager()
                    .getServiceInfo(cn, PackageManager.GET_META_DATA);
            appConfig = info.metaData.getString("metaDataName");
        } catch (PackageManager.NameNotFoundException e) {
            e.printStackTrace();
        }
        return appConfig;
    }

}
