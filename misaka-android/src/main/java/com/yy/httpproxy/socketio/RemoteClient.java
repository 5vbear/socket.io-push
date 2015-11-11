package com.yy.httpproxy.socketio;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.util.Log;

import com.yy.httpproxy.service.RemoteService;
import com.yy.httpproxy.subscribe.PushCallback;
import com.yy.httpproxy.subscribe.PushSubscriber;

import java.util.HashSet;
import java.util.Set;


public class RemoteClient extends BroadcastReceiver implements PushSubscriber {

    private Context context;
    private static final String TAG = "RemoteClient";
    public static final String INTENT = "com.yy.httpproxy.service.RemoteClient.INTENT";
    public static final int CMD_SUBSCRIBE_BROADCAST = 1;
    public static final int CMD_SET_PUSH_ID = 2;
    private PushCallback pushCallback;
    private Set<String> topics = new HashSet<>();

    public RemoteClient(Context context, String host) {
        this.context = context;
        context.registerReceiver(this, new IntentFilter(RemoteService.INTENT));
        Intent intent = new Intent(context, RemoteService.class);
        intent.putExtra("host", host);
        context.startService(intent);
    }

    public void setPushId(String pushId){
        Intent intent = new Intent(INTENT);
        intent.putExtra("cmd", CMD_SET_PUSH_ID);
        intent.putExtra("pushId", pushId);
        context.sendBroadcast(intent);
    }


    @Override
    public void subscribeBroadcast(String topic) {
        doSubscribe(topic);
    }

    private void doSubscribe(String topic) {
        Intent intent = new Intent(INTENT);
        intent.putExtra("cmd", CMD_SUBSCRIBE_BROADCAST);
        intent.putExtra("topic", topic);
        context.sendBroadcast(intent);
    }

    @Override
    public void setPushCallback(PushCallback proxyClient) {
        this.pushCallback = proxyClient;
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        int cmd = intent.getIntExtra("cmd", 0);
        if (cmd == RemoteService.CMD_PUSH) {
            String topic = intent.getStringExtra("topic");
            byte[] data = intent.getByteArrayExtra("data");
            Log.d(TAG, " recieve intent push  " + topic);
            pushCallback.onPush(topic, data);
        } else if (cmd == RemoteService.CMD_CREATED) {
            for (String topic : topics) {
                doSubscribe(topic);
            }
        }
    }
}
