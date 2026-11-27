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

    /** quando o cronômetro desta criança chega a zero (0 = nenhum rodando) e o nome do prêmio, para os avisos falados */
    static void setWarn(Context c, long endMs, String title) { prefs(c).edit().putLong("warnEnd", endMs).putString("warnTitle", title == null ? "" : title).apply(); }

    static long warnEnd(Context c) { return prefs(c).getLong("warnEnd", 0); }

    static String warnTitle(Context c) { return prefs(c).getString("warnTitle", ""); }

    /** como este aparelho se comporta: sound (som e vibração) | vibrate (só vibra) | silent (silencioso); e se fala os avisos do tempo acabando */
    static void setPrefs(Context c, String mode, boolean warn) { prefs(c).edit().putString("mode", mode).putBoolean("warn", warn).apply(); }

    static String mode(Context c) { return prefs(c).getString("mode", "sound"); }

    static boolean warnOn(Context c) { return prefs(c).getBoolean("warn", true); }

    /** o vigia precisa rodar enquanto o bloqueio está ligado OU há um cronômetro para avisar */
    static boolean needService(Context c) { return enabled(c) || warnEnd(c) > System.currentTimeMillis(); }

    /** Evita o mesmo alarme duas vezes (o do Android, o do Firebase e o do app): mesma chave em menos de 2 minutos = ignora */
    static boolean firstRing(Context c, String key) {
        if (key == null || key.isEmpty()) return true;
        SharedPreferences p = prefs(c);
        long now = System.currentTimeMillis();
        if (key.equals(p.getString("ringKey", "")) && now - p.getLong("ringAt", 0) < 120000) return false;
        p.edit().putString("ringKey", key).putLong("ringAt", now).apply();
        return true;
    }

    /** criança que usa este aparelho e qual prêmio libera qual grupo ({ "idDoPremio": "game" | "video" }) */
    static void setKid(Context c, long kid, String mapJson) { prefs(c).edit().putLong("kid", kid).putString("map", mapJson).apply(); }

    static long kid(Context c) { return prefs(c).getLong("kid", 0); }

    static JSONObject map(Context c) { return json(prefs(c).getString("map", "{}")); }

    /** os pais bloquearam o tempo de tela desta criança: jogos e vídeos ficam bloqueados mesmo com tempo */
    static void setLocked(Context c, boolean v) { prefs(c).edit().putBoolean("locked", v).apply(); }

    static boolean locked(Context c) { return prefs(c).getBoolean("locked", false); }

    /** pausa geral (responsável liberou, ou está mexendo nas configurações pelo GameTask) */
    static void pause(Context c, long ms) { prefs(c).edit().putLong("pause", System.currentTimeMillis() + ms).apply(); }

    static boolean paused(Context c) { return System.currentTimeMillis() < prefs(c).getLong("pause", 0); }

    /** o responsável abriu as configurações pelo GameTask: só elas ficam livres por alguns minutos */
    static void settingsGrace(Context c, long ms) { prefs(c).edit().putLong("settings", System.currentTimeMillis() + ms).apply(); }

    private static boolean settingsApp(String pkg) {
        return pkg.equals("com.android.settings") || pkg.equals("com.miui.securitycenter") || pkg.equals("com.samsung.android.lool")
            || pkg.equals("com.android.permissioncontroller") || pkg.equals("com.google.android.permissioncontroller");
    }

    /** responsável liberou este app com o PIN: vale até ele sair do app */
    static synchronized void unlock(Context c, String pkg) {
        if (pkg == null || pkg.isEmpty()) return;
        JSONObject o = json(prefs(c).getString("unlockedApps", "{}"));
        try { o.put(pkg, System.currentTimeMillis()); } catch (Exception ignored) { }
        prefs(c).edit().putString("unlockedApps", o.toString()).apply();
    }

    /** o responsável liberou este app e a tela ainda não bloqueou desde então */
    static boolean isUnlocked(Context c, String pkg) {
        long t = json(prefs(c).getString("unlockedApps", "{}")).optLong(pkg, 0);
        return t > 0 && System.currentTimeMillis() - t < 4 * 3600 * 1000;
    }

    /** a tela bloqueou: tudo que o responsável tinha liberado volta a ficar bloqueado */
    static void clearUnlocked(Context c) { prefs(c).edit().remove("unlockedApps").apply(); }

    static boolean hasPin(Context c) { return !prefs(c).getString("pin", "").isEmpty(); }

    static boolean checkPin(Context c, String pin) { return !pin.isEmpty() && sha(pin).equals(prefs(c).getString("pin", "")); }

    /** grupo que bloqueia este pacote agora, ou null se está livre */
    static String blockedGroup(Context c, String pkg) {
        if (pkg == null || !enabled(c) || paused(c) || pkg.equals(c.getPackageName()) || isUnlocked(c, pkg)) return null;
        if (settingsApp(pkg) && System.currentTimeMillis() < prefs(c).getLong("settings", 0)) return null;
        String g = groups(c).optString(pkg, "");
        if (g.isEmpty() || g.equals("free")) return null;
        if (g.equals("always")) return g;
        if (locked(c)) return g; // bloqueio dos pais vale acima do tempo ganho
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
