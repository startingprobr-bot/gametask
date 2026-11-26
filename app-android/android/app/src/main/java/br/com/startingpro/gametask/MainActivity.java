package br.com.startingpro.gametask;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AlarmPlugin.class); // alarme que toca mesmo no silencioso
        super.onCreate(savedInstanceState);
    }
}
