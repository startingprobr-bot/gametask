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
import android.os.Build;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Tela cheia do alarme: aparece até com o celular bloqueado, com um botão grande para desligar. */
public class AlarmActivity extends Activity {
    static final String CLOSE = "br.com.startingpro.gametask.CLOSE_ALARM";
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

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setBackgroundColor(Color.parseColor("#16296b"));
        int pad = dp(28);
        root.setPadding(pad, pad, pad, pad);

        TextView tag = text("GameTask", 18, Color.parseColor("#ffd23f"), false);
        TextView title = text(getIntent().getStringExtra("title"), 34, Color.WHITE, true);
        TextView body = text(getIntent().getStringExtra("body"), 20, Color.parseColor("#cfe0ff"), false);

        Button off = new Button(this);
        off.setText("Desligar");
        off.setAllCaps(false);
        off.setTextSize(TypedValue.COMPLEX_UNIT_SP, 24);
        off.setTypeface(Typeface.DEFAULT_BOLD);
        off.setTextColor(Color.parseColor("#0d1b4c"));
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.parseColor("#3bd15f"));
        bg.setCornerRadius(dp(40));
        off.setBackground(bg);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(76));
        lp.topMargin = dp(40);
        off.setLayoutParams(lp);
        off.setOnClickListener(v -> { stopService(new Intent(this, AlarmService.class)); finish(); });

        root.addView(tag); root.addView(title); root.addView(body); root.addView(off);
        setContentView(root);

        IntentFilter f = new IntentFilter(CLOSE);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(closer, f, Context.RECEIVER_NOT_EXPORTED); else registerReceiver(closer, f);
    }

    private TextView text(String s, int sp, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(s == null ? "" : s);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        t.setTextColor(color);
        t.setGravity(Gravity.CENTER);
        if (bold) t.setTypeface(Typeface.DEFAULT_BOLD);
        t.setPadding(0, dp(8), 0, dp(8));
        return t;
    }

    private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }

    @Override
    protected void onDestroy() {
        try { unregisterReceiver(closer); } catch (Exception ignored) { }
        super.onDestroy();
    }
}
