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
            // O Capacitor já reserva o espaço do teclado na janela; aqui só as barras do sistema (senão o teclado conta em dobro)
            boolean keyboard = insets.isVisible(WindowInsetsCompat.Type.ime());
            v.setPadding(bars.left, bars.top, bars.right, keyboard ? 0 : bars.bottom);
            return insets;
        });
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).setAppearanceLightStatusBars(false);

        // Voltar: pergunta ao site se há uma tela para voltar (fecha janela, volta ao jogador...). Só na tela inicial sai do app.
        getOnBackPressedDispatcher().addCallback(this, new androidx.activity.OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                getBridge().getWebView().evaluateJavascript("(function(){try{return window.__gtBack?window.__gtBack():false}catch(e){return false}})()", value -> {
                    if (!"true".equals(value)) moveTaskToBack(true); // sem tela para voltar: guarda o app (não fecha)
                });
            }
        });
    }

    @Override
    public void onResume() {
        super.onResume();
        BlockService.sync(this); // o vigia do bloqueio volta a rodar sempre que o app abre (ex.: depois de atualizar)
    }
}
