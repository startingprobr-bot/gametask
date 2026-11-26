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
        root.addView(new View(this), new LinearLayout.LayoutParams(1, dp(16)));

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

    // PIN de desbloqueio com teclado grande: libera este app até o responsável sair dele
    private final StringBuilder typed = new StringBuilder();
    private TextView dots;

    private void askPin(LinearLayout ignored) {
        if (!BlockStore.hasPin(this)) { Toast.makeText(this, "Configure o PIN de desbloqueio no GameTask", Toast.LENGTH_LONG).show(); return; }
        typed.setLength(0);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        root.setBackground(new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
            new int[] { Color.parseColor("#4aa8ff"), Color.parseColor("#2a6cf0"), Color.parseColor("#16296b") }));
        root.setPadding(dp(24), dp(48), dp(24), dp(40));
        root.addView(text("Sou responsável", 28, Color.WHITE, true));
        TextView h = text("Digite o PIN de desbloqueio. O app fica liberado até você sair dele.", 17, Color.parseColor("#d6e4ff"), false);
        h.setPadding(0, dp(6), 0, dp(18));
        root.addView(h);
        dots = text("", 40, Color.WHITE, true);
        dots.setLetterSpacing(0.3f);
        dots.setMinHeight(dp(64));
        root.addView(dots);
        paintDots();

        String[][] keys = { { "1", "2", "3" }, { "4", "5", "6" }, { "7", "8", "9" }, { "⌫", "0", "OK" } };
        for (String[] row : keys) {
            LinearLayout r = new LinearLayout(this);
            r.setGravity(Gravity.CENTER);
            for (String k : row) {
                boolean ok = k.equals("OK");
                TextView key = button(k, ok ? "#8cf28a" : "#ffffff", ok ? "#3bd15f" : "#e3ecff", NAVY);
                key.setTextSize(TypedValue.COMPLEX_UNIT_SP, ok ? 24 : 30);
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(dp(92), dp(80));
                lp.setMargins(dp(8), dp(8), dp(8), dp(8));
                key.setOnClickListener(v -> press(k));
                r.addView(key, lp);
            }
            root.addView(r);
        }
        TextView cancel = text("Cancelar", 18, Color.WHITE, true);
        cancel.setPadding(0, dp(18), 0, 0);
        cancel.setOnClickListener(v -> recreate());
        root.addView(cancel);
        setContentView(root);
    }

    private void press(String k) {
        if (k.equals("⌫")) { if (typed.length() > 0) typed.setLength(typed.length() - 1); }
        else if (k.equals("OK")) {
            String pkg = getIntent().getStringExtra("pkg");
            if (BlockStore.checkPin(this, typed.toString())) {
                BlockStore.unlock(this, pkg);
                Toast.makeText(this, "Liberado até você sair do app", Toast.LENGTH_SHORT).show();
                Intent open = pkg == null ? null : getPackageManager().getLaunchIntentForPackage(pkg);
                finish();
                if (open != null) startActivity(open);
                return;
            }
            typed.setLength(0);
            dots.animate().translationX(dp(14)).setDuration(60).withEndAction(() -> dots.animate().translationX(-dp(14)).setDuration(60)
                .withEndAction(() -> dots.animate().translationX(0).setDuration(60).start()).start()).start();
            Toast.makeText(this, "PIN incorreto", Toast.LENGTH_SHORT).show();
        } else if (typed.length() < 8) typed.append(k);
        paintDots();
    }

    private void paintDots() {
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < Math.max(4, typed.length()); i++) b.append(i < typed.length() ? "●" : "○");
        dots.setText(b.toString());
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
