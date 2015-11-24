package com.yy.httpproxy.socketio;

import android.os.Handler;
import android.util.Base64;
import android.util.Log;

import com.yy.httpproxy.AndroidLoggingHandler;
import com.yy.httpproxy.requester.HttpRequester;
import com.yy.httpproxy.requester.RequestException;
import com.yy.httpproxy.requester.RequestInfo;
import com.yy.httpproxy.requester.ResponseHandler;
import com.yy.httpproxy.subscribe.PushCallback;
import com.yy.httpproxy.subscribe.PushIdCallback;
import com.yy.httpproxy.subscribe.PushIdGenerator;
import com.yy.httpproxy.subscribe.PushSubscriber;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Level;

import io.socket.client.IO;
import io.socket.client.Socket;
import io.socket.emitter.Emitter;


public class SocketIOProxyClient implements HttpRequester, PushSubscriber {

    private static String TAG = "SocketIoRequester";
    private PushCallback pushCallback;
    private String pushId;
    private NotificationCallback notificationCallback;
    private Set<String> topics = new HashSet<>();

    public interface NotificationCallback {
        void onNotification(String id, JSONObject notification);
    }

    private final Emitter.Listener connectListener = new Emitter.Listener() {
        @Override
        public void call(Object... args) {
            sendPushIdAndTopicToServer();
            reSendFailedRequest();
        }
    };

    private void reSendFailedRequest() {
        if (!replyCallbacks.isEmpty()) {
            List<Request> values = new ArrayList<>(replyCallbacks.values());
            replyCallbacks.clear();
            for (Request request : values) {
                Log.i(TAG, "StompClient onConnected repost request " + request.getRequestInfo().getUrl());
                request(request.getRequestInfo(), request.getResponseHandler());
            }
        }
    }

    private void sendPushIdAndTopicToServer() {
        if (pushId != null && socket.connected()) {
            Log.i(TAG, "sendPushIdAndTopicToServer " + pushId);
            JSONObject object = new JSONObject();
            try {
                object.put("id", pushId);
                if (topics.size() > 0) {
                    JSONArray array = new JSONArray();
                    object.put("topics", array);
                    for (String topic : topics) {
                        array.put(topic);
                    }
                }
                socket.emit("pushId", object);
            } catch (JSONException e) {
                Log.e(TAG, "connectListener error ", e);
            }
        }
    }

    private final Emitter.Listener pushIdListener = new Emitter.Listener() {
        @Override
        public void call(Object... args) {
            JSONObject data = (JSONObject) args[0];
            String pushId = data.optString("id");
            Log.v(TAG, "on pushId " + pushId);
        }
    };

    private final Emitter.Listener notificationListener = new Emitter.Listener() {
        @Override
        public void call(Object... args) {
            if (notificationCallback != null) {
                try {
                    JSONObject data = (JSONObject) args[0];
                    JSONObject android = data.optJSONObject("android");
                    Log.v(TAG, "on notification topic " + android);
                    notificationCallback.onNotification(data.optString("id"), android);
                } catch (Exception e) {
                    Log.e(TAG, "handle notification error ", e);
                }
            }
        }
    };

    private final Emitter.Listener pushListener = new Emitter.Listener() {
        @Override
        public void call(Object... args) {
            if (pushCallback != null) {
                try {
                    JSONObject data = (JSONObject) args[0];
                    String topic = data.optString("topic");
                    String dataBase64 = data.optString("data");
                    boolean reply = data.optBoolean("reply", false);
                    if (reply) {
                        data.put("pushId", pushId);
                        data.remove("data");
                        socket.emit("pushReply", data);
                    }
                    Log.v(TAG, "on push topic " + topic + " data:" + dataBase64);
                    pushCallback.onPush(topic, Base64.decode(dataBase64, Base64.DEFAULT));
                } catch (Exception e) {
                    Log.e(TAG, "handle push error ", e);
                }
            }
        }
    };
    private Map<Integer, Request> replyCallbacks = new ConcurrentHashMap<>();
    private Handler handler = new Handler();
    private long timeout = 20000;
    private Runnable timeoutTask = new Runnable() {
        @Override
        public void run() {
            Iterator<Map.Entry<Integer, Request>> it = replyCallbacks.entrySet().iterator();
            while (it.hasNext()) {
                Map.Entry<Integer, Request> pair = it.next();
                Request request = pair.getValue();
                if (request.timeoutForRequest(timeout)) {
                    Log.i(TAG, "StompClient timeoutForRequest " + request.getRequestInfo().getUrl());
                    if (request.getResponseHandler() != null) {
                        request.getResponseHandler().onError(new RequestException(null, RequestException.Error.TIMEOUT_ERROR));
                    }
                    it.remove();
                    continue;
                }
            }
            postTimeout();
        }
    };
    private int sequenceId;

    private void postTimeout() {
        handler.removeCallbacks(timeoutTask);
        if (replyCallbacks.size() > 0) {
            handler.postDelayed(timeoutTask, 1000);
        }
    }

    private final Emitter.Listener httpProxyListener = new Emitter.Listener() {
        @Override
        public void call(Object... args) {
            Log.v(TAG, "httpProxy call " + args + " thread " + Thread.currentThread().getName());
            if (args.length > 0 && args[0] instanceof JSONObject) {
                JSONObject data = (JSONObject) args[0];
                int responseSeqId = data.optInt("sequenceId", 0);
                Request request = replyCallbacks.remove(responseSeqId);
                if (request != null && request.getResponseHandler() != null) {
                    try {
                        String errorMessage = data.optString("errorMessage");
                        boolean error = data.optBoolean("error", false);
                        if (error) {
                            request.getResponseHandler().onError(new RequestException(null, RequestException.Error.CONNECT_ERROR.value, errorMessage));
                        } else {
                            String response = data.optString("data");
                            byte[] decodedResponse = Base64.decode(response, Base64.DEFAULT);
                            Log.i(TAG, "response " + new String(decodedResponse));
                            int statusCode = data.optInt("statusCode", 0);
                            Map<String, String> headers = new HashMap<>();
//                            JSONObject headerObject = data.optJSONObject("headers");
//                            Iterator<String> it = headerObject.keys();
//                            while (it.hasNext()) {
//                                String key = it.next();
//                                headers.put(key, headerObject.optString(key));
//                            }
                            request.getResponseHandler().onSuccess(headers, statusCode, decodedResponse);
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "httpproxy emmit parse error", e);
                        request.getResponseHandler().onError(new RequestException(e, RequestException.Error.SERVER_DATA_SERIALIZE_ERROR));
                    }
                }
            }
        }
    };

    private Socket socket;

    public SocketIOProxyClient(String host) {
        AndroidLoggingHandler.reset(new AndroidLoggingHandler());
        java.util.logging.Logger.getLogger("").setLevel(Level.FINEST);
        topics.add("android");
        try {
            IO.Options opts = new IO.Options();
            opts.transports = new String[]{"websocket"};
            socket = IO.socket(host, opts);
            socket.on("packetProxy", httpProxyListener);
            socket.on(Socket.EVENT_CONNECT, connectListener);
            socket.on("pushId", pushIdListener);
            socket.on("push", pushListener);
            socket.on("notification", notificationListener);
            socket.connect();
        } catch (URISyntaxException e) {
            throw new RuntimeException(e);
        }

    }

    @Override
    public void request(RequestInfo requestInfo, ResponseHandler handler) {

        try {
            sequenceId = sequenceId + 1;

            if (handler != null) {
                Request request = new Request(requestInfo, handler);
                replyCallbacks.put(sequenceId, request);
            }

            if (!socket.connected()) {
                return;
            }


            JSONObject headers = new JSONObject();
            if (requestInfo.getHeaders() != null) {
                for (Map.Entry<String, String> header : requestInfo.getHeaders().entrySet()) {
                    headers.put(header.getKey(), header.getValue());
                }
            }

            JSONObject object = new JSONObject();
            object.put("headers", headers);
            object.put("data", Base64.encodeToString(requestInfo.getBody(), Base64.DEFAULT));
            object.put("host", requestInfo.getHost());
            object.put("port", requestInfo.getPort());
            object.put("method", requestInfo.getMethod());
            object.put("path", requestInfo.getPath());
            object.put("sequenceId", String.valueOf(sequenceId));


            socket.emit("packetProxy", object);

            postTimeout();


        } catch (Exception e) {
            handler.onError(new RequestException(e, RequestException.Error.CLIENT_DATA_SERIALIZE_ERROR));
        }
    }

    @Override
    public void subscribeBroadcast(String topic) {
        topics.add(topic);
        if (socket.connected()) {
            JSONObject data = new JSONObject();
            try {
                data.put("topic", topic);
                socket.emit("subscribeTopic", data);
            } catch (JSONException e) {
                e.printStackTrace();
            }
        }
    }

    @Override
    public void setPushCallback(PushCallback pushCallback) {
        this.pushCallback = pushCallback;
    }

    public void setPushId(String pushId) {
        this.pushId = pushId;
        sendPushIdAndTopicToServer();
    }

    public void setNotificationCallback(NotificationCallback notificationCallback) {
        this.notificationCallback = notificationCallback;
    }
}
