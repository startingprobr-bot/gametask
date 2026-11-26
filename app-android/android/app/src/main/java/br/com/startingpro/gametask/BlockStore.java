package br.com.startingpro.gametask;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONObject;

import java.security.MessageDigest;

/**
 * Regras do bloqueio de apps guardadas no aparelho (funciona sem internet).
 * groups: { "pacote": "game" | "video" | "always" }   allowed: { "game": ateQuandoMs, "video": ateQuandoMs }
 */
public class BlockStore {
    private static final String P = "gt_block";

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(P, Context.MODE_PRIVATE); }

    static boolean enabled(Context c) { return prefs(c).getBoolean("on", false); }

    static JSONObject groups(Context c) { return json(prefs(c).getString("groups", "{}")); }

    static JSONObject allowed(Context c) { return json(prefs(c).getString("allowed", "{}")); }

    static void save(Context c, boolean on, String groupsJson, String pinHash) {
        SharedPreferences.Editor e = prefs(c).edit().putBoolean("on", on).putString("groups", groupsJson);
        if (pinHash != null && !pinHash.isEmpty()) e.putString("pin", pinHash);
        e.apply();
    }

    static void setAllowed(Context c, String allowedJson) { prefs(c).edit().putString("allowed", allowedJson).apply(); }

    /** pausa geral (responsável liberou, ou está mexendo nas configurações pelo GameTask) */
    static void pause(Context c, long ms) { prefs(c).edit().putLong("pause", System.currentTimeMillis() + ms).apply(); }

    static boolean paused(Context c) { return System.currentTimeMillis() < prefs(c).getLong("pause", 0); }

    static boolean hasPin(Context c) { return !prefs(c).getString("pin", "").isEmpty(); }

    static boolean checkPin(Context c, String pin) { return !pin.isEmpty() && sha(pin).equals(prefs(c).getString("pin", "")); }

    /** grupo que bloqueia este pacote agora, ou null se está livre */
    static String blockedGroup(Context c, String pkg) {
        if (pkg == null || !enabled(c) || paused(c) || pkg.equals(c.getPackageName())) return null;
        String g = groups(c).optString(pkg, "");
        if (g.isEmpty() || g.equals("free")) return null;
        if (g.equals("always")) return g;
        return System.currentTimeMillis() < allowed(c).optLong(g, 0) ? null : g;
    }

    static String sha(String s) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(("gt:" + s).getBytes("UTF-8"));
            StringBuilder b = new StringBuilder();
            for (byte x : d) b.append(String.format("%02x", x));
            return b.toString();
        } catch (Exception e) { return ""; }
    }

    private static JSONObject json(String s) { try { return new JSONObject(s); } catch (Exception e) { return new JSONObject(); } }
}
