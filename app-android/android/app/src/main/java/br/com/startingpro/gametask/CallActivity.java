package br.com.startingpro.gametask;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
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
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Ligação da família chegando: tela cheia (até bloqueado) com Atender e Recusar. Atender abre o GameTask na ligação. */
public class CallActivity extends Activity {
    private static final int NAVY = Color.parseColor("#0d1b4c");

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true); setTurnScreenOn(true);
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null) km.requestDismissKeyguard(this, null);
        } else getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setStatusBarColor(Color.parseColor("#2fb35a"));
        getWindow().setNavigationBarColor(Color.parseColor("#0f5e33"));
        String call = getIntent().getStringExtra("call"), title = getIntent().getStringExtra("title");

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        root.setBackground(new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
            new int[] { Color.parseColor("#3bd15f"), Color.parseColor("#1f9a4a"), Color.parseColor("#0f5e33") }));
        root.setPadding(dp(28), dp(72), dp(28), dp(64));

        root.addView(text("Ligação da família", 18, Color.parseColor("#e6ffe9"), true));
        TextView who = text(title == null ? "Ligação" : title.replace("Ligação de ", ""), 40, Color.WHITE, true);
        who.setPadding(0, dp(10), 0, 0);
        root.addView(who);
        root.addView(space());

        ImageView icon = new ImageView(this);
        icon.setImageResource(R.mipmap.ic_launcher);
        icon.setScaleType(ImageView.ScaleType.CENTER_CROP);
        GradientDrawable clip = new GradientDrawable(); clip.setShape(GradientDrawable.OVAL);
        icon.setBackground(clip); icon.setClipToOutline(true);
        LinearLayout.LayoutParams ip = new LinearLayout.LayoutParams(dp(132), dp(132)); ip.gravity = Gravity.CENTER_HORIZONTAL;
        root.addView(icon, ip);
        RotateAnimation rot = new RotateAnimation(-10, 10, Animation.RELATIVE_TO_SELF, .5f, Animation.RELATIVE_TO_SELF, .5f);
        rot.setDuration(1000); rot.setInterpolator(new CycleInterpolator(2)); rot.setRepeatCount(Animation.INFINITE);
        icon.startAnimation(rot);
        root.addView(space());

        LinearLayout row = new LinearLayout(this);
        row.setGravity(Gravity.CENTER);
        TextView no = button("Recusar", "#ff8a95", "#ff4d5e", Color.WHITE);
        TextView yes = button("Atender", "#8cf28a", "#3bd15f", NAVY);
        LinearLayout.LayoutParams bl = new LinearLayout.LayoutParams(0, dp(84), 1f); bl.setMargins(dp(8), 0, dp(8), 0);
        row.addView(no, bl);
        row.addView(yes, new LinearLayout.LayoutParams(bl));
        root.addView(row, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        no.setOnClickListener(v -> { stopService(new Intent(this, AlarmService.class)); keep("declined", call); finish(); });
        yes.setOnClickListener(v -> {
            stopService(new Intent(this, AlarmService.class));
            keep("answer", call);
            startActivity(new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP));
            finish();
        });
        setContentView(root);
    }

    // o site pergunta ao app ao abrir: atender esta ligação ou avisar que foi recusada
    private void keep(String k, String call) { getSharedPreferences("gt_call", MODE_PRIVATE).edit().putString(k, call == null ? "" : call).apply(); }

    private View space() { View s = new View(this); s.setLayoutParams(new LinearLayout.LayoutParams(1, 0, 1f)); return s; }

    private TextView button(String label, String top, String bottom, int fg) {
        TextView t = text(label, 24, fg, true);
        GradientDrawable shadow = new GradientDrawable(); shadow.setColor(NAVY); shadow.setCornerRadius(dp(42));
        GradientDrawable face = new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, new int[] { Color.parseColor(top), Color.parseColor(bottom) });
        face.setCornerRadius(dp(42)); face.setStroke(dp(3), NAVY);
        LayerDrawable ld = new LayerDrawable(new Drawable[] { shadow, face }); ld.setLayerInset(1, 0, 0, 0, dp(6));
        t.setBackground(ld); t.setPadding(0, 0, 0, dp(6)); t.setClickable(true);
        return t;
    }

    private TextView text(String s, int sp, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(s); t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp); t.setTextColor(color); t.setGravity(Gravity.CENTER);
        if (bold) t.setTypeface(Typeface.create("sans-serif-black", Typeface.NORMAL));
        return t;
    }

    private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }
}
