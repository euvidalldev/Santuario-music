package com.sanctuary.musicplayer.plugins;

import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

@CapacitorPlugin(name = "NativeHttp")
public class NativeHttpPlugin extends Plugin {

    private static final String TAG = "NativeHttp";

    @PluginMethod
    public void request(PluginCall call) {
        String urlStr = call.getString("url");
        String method = call.getString("method", "GET");
        JSObject headers = call.getObject("headers", new JSObject());
        String body = call.getString("body");
        String responseType = call.getString("responseType", "text");

        if (urlStr == null || urlStr.isEmpty()) {
            call.reject("URL is required");
            return;
        }

        try {
            URL url = new URL(urlStr);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod(method);
            conn.setConnectTimeout(30000);
            conn.setReadTimeout(120000);

            // Set headers
            Iterator<String> keys = headers.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                String value = headers.getString(key);
                if (value != null) {
                    conn.setRequestProperty(key, value);
                }
            }

            // Write body for POST/PUT
            if (body != null && !body.isEmpty() && (method.equals("POST") || method.equals("PUT") || method.equals("PATCH"))) {
                conn.setDoOutput(true);
                try (OutputStream os = conn.getOutputStream()) {
                    byte[] input = body.getBytes("utf-8");
                    os.write(input, 0, input.length);
                }
            }

            int status = conn.getResponseCode();
            String statusText = conn.getResponseMessage();

            // Build response headers JSON
            JSObject responseHeaders = new JSObject();
            for (Map.Entry<String, List<String>> entry : conn.getHeaderFields().entrySet()) {
                String key = entry.getKey();
                if (key != null && !entry.getValue().isEmpty()) {
                    responseHeaders.put(key, entry.getValue().get(0));
                }
            }

            JSObject result = new JSObject();
            result.put("status", status);
            result.put("statusText", statusText != null ? statusText : "");
            result.put("headers", responseHeaders);

            // Read response
            InputStream inputStream = status >= 200 && status < 300 ?
                conn.getInputStream() : conn.getErrorStream();

            if ("blob".equals(responseType)) {
                ByteArrayOutputStream buffer = new ByteArrayOutputStream();
                byte[] tmp = new byte[8192];
                int count;
                while ((count = inputStream.read(tmp)) != -1) {
                    buffer.write(tmp, 0, count);
                }
                inputStream.close();
                byte[] data = buffer.toByteArray();
                String base64 = Base64.encodeToString(data, Base64.NO_WRAP);
                result.put("body", base64);
            } else {
                BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream, "utf-8"));
                StringBuilder responseBody = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    responseBody.append(line).append("\n");
                }
                reader.close();
                result.put("body", responseBody.toString().trim());
            }

            call.resolve(result);

        } catch (Exception e) {
            Log.e(TAG, "HTTP request failed: " + e.getMessage());
            call.reject("HTTP request failed: " + e.getMessage());
        }
    }
}
