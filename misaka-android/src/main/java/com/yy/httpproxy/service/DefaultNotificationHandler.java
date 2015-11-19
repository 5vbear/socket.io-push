package com.yy.httpproxy.service;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.support.v4.app.NotificationCompat;

/**
 * Created by xuduo on 11/6/15.
 */

public class DefaultNotificationHandler implements NotificationHandler {

    public static final String INTENT_TAIL = ".YY_NOTIFICATION";


    @Override
    public void handlerNotification(Context context, PushedNotification pushedNotification) {
        String intentName = context.getApplicationInfo().packageName + INTENT_TAIL;
        Intent pushIntent = new Intent(intentName);
        pushIntent.putExtra("cmd", RemoteService.CMD_NOTIFICATION_CLICKED);
        pushIntent.putExtra("id", pushedNotification.values);
        pushIntent.putExtra("notification", pushedNotification.values);
        PendingIntent pendingIntent = PendingIntent.getBroadcast(context, 1, pushIntent, 0);


        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        NotificationCompat.Builder mBuilder =
                new NotificationCompat.Builder(context)
                        .setAutoCancel(true)
                        .setContentIntent(pendingIntent)
                        .setSmallIcon(context.getApplicationInfo().icon)
                        .setContentTitle((CharSequence) pushedNotification.values.get("title"))
                        .setContentText((CharSequence) pushedNotification.values.get("message")).setPriority(NotificationCompat.PRIORITY_HIGH);
        Notification notification = mBuilder.build();
        nm.notify(pushedNotification.id.hashCode(), notification);
    }
}
