package br.com.startingpro.gametask;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.LayerDrawable;
import android.os.Build;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.view.animation.Animation;
import android.view.animation.CycleInterpolator;
import android.view.animation.RotateAnimation;
import android.view.animation.ScaleAnimation;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Tela cheia do alarme, com a cara do GameTask: hora grande, ícone balançando, o que fazer em destaque
 * e um botão de jogo para desligar. Aparece até com o celular bloqueado.
 */
public class AlarmActivity extends Activity {
    static final String CLOSE = "br.com.startingpro.gametask.CLOSE_ALARM";
    private static final int NAVY = Color.parseColor("#0d1b4c"), YELLOW = Color.parseColor("#ffd23f");
    private final BroadcastReceiver closer = new BroadcastReceiver() {
        @Override public void onReceive(Context c, Intent i) { finish(); }
    };

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null) km.requestDismissKeyguard(this, null);
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setStatusBarColor(Color.parseColor("#3d8ff5"));
        getWindow().setNavigationBarColor(Color.parseColor("#16296b"));

        String title = nz(getIntent().getStringExtra("title")), body = nz(getIntent().getStringExtra("body"));
        boolean msg = title.startsWith("Recado");
        // recado: a mensagem é o principal; alarme de missão: a missão é o principal
        String kicker = msg ? title : title.startsWith("Teste") ? "Teste do alarme" : title.startsWith("O tempo de") || title.contains("acabou o tempo") ? "Tempo de tela"
            : body.startsWith("Aviso") ? "Aviso" : title.contains("missão cumprida") ? "Cronômetro" : "Hora da missão";
        String big = msg ? body : title, small = msg ? "" : body;

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        GradientDrawable bg = new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
            new int[] { Color.parseColor("#4aa8ff"), Color.parseColor("#2a6cf0"), Color.parseColor("#16296b") });
        root.setBackground(bg);
        root.setPadding(dp(28), dp(56), dp(28), dp(72)); // espaço para a barra de navegação

        TextView clock = text(new SimpleDateFormat("HH:mm", new Locale("pt", "BR")).format(new Date()), 64, Color.WHITE, true);
        clock.setShadowLayer(dp(6), 0, dp(3), Color.parseColor("#55000000"));
        root.addView(clock);
        TextView brand = text("GameTask", 18, YELLOW, true);
        brand.setLetterSpacing(0.08f);
        root.addView(brand);

        root.addView(space(1));

        // ícone do app num círculo branco, balançando como um sino
        FrameLayout badge = new FrameLayout(this);
        GradientDrawable ring = new GradientDrawable();
        ring.setShape(GradientDrawable.OVAL);
        ring.setColor(Color.WHITE);
        ring.setStroke(dp(5), NAVY);
        badge.setBackground(ring);
        badge.setElevation(dp(10));
        ImageView icon = new ImageView(this);
        // GameTask: imagem quadrada recortada em círculo, ocupando a moldura toda
        icon.setImageResource(R.mipmap.ic_launcher);
        icon.setScaleType(ImageView.ScaleType.CENTER_CROP);
        GradientDrawable clip = new GradientDrawable();
        clip.setShape(GradientDrawable.OVAL);
        icon.setBackground(clip);
        icon.setClipToOutline(true);
        FrameLayout.LayoutParams ilp = new FrameLayout.LayoutParams(dp(118), dp(118), Gravity.CENTER);
        badge.addView(icon, ilp);
        // alarme de um filho só: o personagem dele, inteiro, no lugar do ícone
        String av = getIntent().getStringExtra("icon");
        if (AvatarCache.valid(av)) new Thread(() -> {
            android.graphics.Bitmap bmp = AvatarCache.load(this, av);
            if (bmp != null) runOnUiThread(() -> {
                icon.setImageBitmap(bmp);
                icon.setScaleType(ImageView.ScaleType.FIT_CENTER);
                icon.setBackground(null);
                icon.setClipToOutline(false);
                icon.setLayoutParams(new FrameLayout.LayoutParams(dp(96), dp(96), Gravity.CENTER));
            });
        }).start();
        LinearLayout.LayoutParams blp = new LinearLayout.LayoutParams(dp(128), dp(128));
        blp.gravity = Gravity.CENTER_HORIZONTAL;
        root.addView(badge, blp);
        ring(badge);

        TextView k = text(kicker, 18, Color.parseColor("#d6e4ff"), true);
        k.setPadding(dp(8), dp(26), dp(8), dp(4));
        root.addView(k);
        TextView main = text(big.isEmpty() ? title : big, big.length() > 40 ? 28 : 36, Color.WHITE, true);
        main.setShadowLayer(dp(4), 0, dp(2), Color.parseColor("#66000000"));
        root.addView(main);
        if (!small.isEmpty()) root.addView(text(small, 19, Color.parseColor("#cfe0ff"), false));

        root.addView(space(1));

        TextView off = text("Desligar", 26, NAVY, true);
        off.setBackground(gameButton());
        off.setPadding(0, 0, 0, dp(6));
        off.setClickable(true);
        off.setFocusable(true);
        off.setOnClickListener(v -> { stopService(new Intent(this, AlarmService.class)); finish(); });
        LinearLayout.LayoutParams olp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(84));
        root.addView(off, olp);
        TextView hint = text("O alarme para sozinho em 3 minutos", 14, Color.parseColor("#a9bdf0"), false);
        hint.setPadding(0, dp(12), 0, 0);
        root.addView(hint);

        setContentView(root);

        IntentFilter f = new IntentFilter(CLOSE);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(closer, f, Context.RECEIVER_NOT_EXPORTED); else registerReceiver(closer, f);
    }

    // botão verde com a "sombra" escura embaixo, igual aos botões do app
    private LayerDrawable gameButton() {
        float r = dp(42);
        GradientDrawable shadow = new GradientDrawable();
        shadow.setColor(NAVY);
        shadow.setCornerRadius(r);
        GradientDrawable face = new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
            new int[] { Color.parseColor("#8cf28a"), Color.parseColor("#3bd15f") });
        face.setCornerRadius(r);
        face.setStroke(dp(3), NAVY);
        LayerDrawable ld = new LayerDrawable(new android.graphics.drawable.Drawable[] { shadow, face });
        ld.setLayerInset(1, 0, 0, 0, dp(6));
        return ld;
    }

    private void ring(View v) {
        RotateAnimation rot = new RotateAnimation(-14, 14, Animation.RELATIVE_TO_SELF, 0.5f, Animation.RELATIVE_TO_SELF, 0.15f);
        rot.setDuration(1400);
        rot.setInterpolator(new CycleInterpolator(3));
        rot.setRepeatCount(Animation.INFINITE);
        v.startAnimation(rot);
    }

    private View space(float weight) {
        View s = new View(this);
        s.setLayoutParams(new LinearLayout.LayoutParams(1, 0, weight));
        return s;
    }

    private TextView text(String s, int sp, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        t.setTextColor(color);
        t.setGravity(Gravity.CENTER);
        if (bold) t.setTypeface(Typeface.create("sans-serif-black", Typeface.NORMAL));
        t.setPadding(dp(4), dp(4), dp(4), dp(4));
        return t;
    }

    private static String nz(String s) { return s == null ? "" : s.trim(); }

    private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }

    @Override
    protected void onDestroy() {
        try { unregisterReceiver(closer); } catch (Exception ignored) { }
        super.onDestroy();
    }
}
