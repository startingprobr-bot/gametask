package br.com.startingpro.gametask;

import android.os.Bundle;
import android.view.View;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AlarmPlugin.class); // alarme que toca mesmo no silencioso
        super.onCreate(savedInstanceState);
        // o site fica entre a barra do relógio e a barra de navegação (não por baixo delas)
        View web = getBridge().getWebView(), box = (View) web.getParent();
        box.setBackgroundColor(0xFF16296B);
        ViewCompat.setOnApplyWindowInsetsListener(box, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            v.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));
            return WindowInsetsCompat.CONSUMED;
        });
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).setAppearanceLightStatusBars(false);
    }

    @Override
    public void onResume() {
        super.onResume();
        BlockService.sync(this); // o vigia do bloqueio volta a rodar sempre que o app abre (ex.: depois de atualizar)
    }
}
