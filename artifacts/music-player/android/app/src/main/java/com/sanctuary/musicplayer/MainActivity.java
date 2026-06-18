package com.sanctuary.musicplayer;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.sanctuary.musicplayer.plugins.NativeHttpPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeHttpPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
