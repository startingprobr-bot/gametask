package br.com.startingpro.gametask;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.LayerDrawable;
import android.os.Bundle;
import android.text.InputType;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

/** Tela que aparece por cima de um app bloqueado. A criança volta para o GameTask; o responsável libera com o PIN. */
public class BlockActivity extends Activity {
    private static final int NAVY = Color.parseColor("#0d1b4c");

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().setStatusBarColor(Color.parseColor("#3d8ff5"));
        getWindow().setNavigationBarColor(Color.parseColor("#16296b"));
        String group = getIntent().getStringExtra("group"), pkg = getIntent().getStringExtra("pkg");

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        root.setBackground(new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
            new int[] { Color.parseColor("#4aa8ff"), Color.parseColor("#2a6cf0"), Color.parseColor("#16296b") }));
        root.setPadding(dp(28), dp(64), dp(28), dp(56));

        // ícone do app que foi bloqueado, com um cadeado
        ImageView app = new ImageView(this);
        try { Drawable d = getPackageManager().getApplicationIcon(pkg); app.setImageDrawable(d); } catch (Exception e) { app.setImageResource(R.mipmap.ic_launcher); }
        app.setAlpha(0.55f);
        root.addView(app, new LinearLayout.LayoutParams(dp(96), dp(96)));
        TextView lock = text("🔒", 44, Color.WHITE, false);
        lock.setPadding(0, dp(-30), 0, 0);
        root.addView(lock);

        String what = "always".equals(group) ? "Este app está bloqueado" : "game".equals(group) ? "Hora de jogar? Ainda não!" : "Hora de vídeo? Ainda não!";
        String sub = "always".equals(group) ? "Só um responsável pode abrir este app."
            : "Faça suas missões no GameTask para ganhar tempo. Quando der o play no cronômetro, este app libera.";
        root.addView(text(what, 30, Color.WHITE, true));
        TextView s = text(sub, 18, Color.parseColor("#d6e4ff"), false);
        s.setPadding(0, dp(8), 0, 0);
        root.addView(s);

        View sp = new View(this); root.addView(sp, new LinearLayout.LayoutParams(1, 0, 1f));

        TextView go = button("Ir para as missões", "#8cf28a", "#3bd15f", NAVY);
        go.setOnClickListener(v -> { startActivity(new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); finish(); });
        root.addView(go, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(76)));

        TextView parent = text("Sou responsável", 18, Color.WHITE, true);
        parent.setPadding(0, dp(20), 0, dp(6));
        parent.setOnClickListener(v -> askPin(root));
        root.addView(parent);
        setContentView(root);
    }

    // PIN de desbloqueio: libera tudo por 15 minutos
    private void askPin(LinearLayout root) {
        if (!BlockStore.hasPin(this)) { Toast.makeText(this, "Configure o PIN de desbloqueio no GameTask", Toast.LENGTH_LONG).show(); return; }
        EditText pin = new EditText(this);
        pin.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_VARIATION_PASSWORD);
        pin.setHint("PIN de desbloqueio");
        pin.setGravity(Gravity.CENTER);
        pin.setTextSize(TypedValue.COMPLEX_UNIT_SP, 24);
        pin.setBackgroundColor(Color.WHITE);
        pin.setTextColor(NAVY);
        new android.app.AlertDialog.Builder(this).setTitle("Liberar por 15 minutos").setView(pin)
            .setPositiveButton("Liberar", (d, w) -> {
                if (BlockStore.checkPin(this, pin.getText().toString().trim())) { BlockStore.pause(this, 15 * 60 * 1000); Toast.makeText(this, "Liberado por 15 minutos", Toast.LENGTH_SHORT).show(); finish(); }
                else Toast.makeText(this, "PIN incorreto", Toast.LENGTH_SHORT).show();
            }).setNegativeButton("Cancelar", null).show();
    }

    // voltar não reabre o app bloqueado: vai para a tela inicial
    @Override
    public void onBackPressed() {
        startActivity(new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        finish();
    }

    private TextView button(String label, String top, String bottom, int fg) {
        TextView t = text(label, 24, fg, true);
        GradientDrawable shadow = new GradientDrawable(); shadow.setColor(NAVY); shadow.setCornerRadius(dp(40));
        GradientDrawable face = new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, new int[] { Color.parseColor(top), Color.parseColor(bottom) });
        face.setCornerRadius(dp(40)); face.setStroke(dp(3), NAVY);
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
