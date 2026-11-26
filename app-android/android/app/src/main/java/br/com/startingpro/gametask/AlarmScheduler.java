package br.com.startingpro.gametask;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

/** Guarda a lista de alarmes e marca cada um no AlarmManager como despertador (setAlarmClock). */
public class AlarmScheduler {
    private static final String PREFS = "gt_alarms", KEY = "items";

    static boolean canExact(Context ctx) {
        if (Build.VERSION.SDK_INT < 31) return true;
        return ((AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE)).canScheduleExactAlarms();
    }

    static synchronized void replace(Context ctx, JSONArray items) {
        cancelAll(ctx);
        JSONArray keep = new JSONArray();
        long now = System.currentTimeMillis();
        for (int i = 0; i < items.length() && keep.length() < 300; i++) {
            JSONObject it = items.optJSONObject(i);
            if (it == null || it.optLong("at") <= now) continue;
            keep.put(it);
        }
        prefs(ctx).edit().putString(KEY, keep.toString()).apply();
        scheduleSaved(ctx);
        java.util.Set<String> icons = new java.util.HashSet<>();
        for (int i = 0; i < keep.length(); i++) icons.add(keep.optJSONObject(i).optString("icon"));
        AvatarCache.prefetch(ctx, icons);
    }

    /** Remarca o que está guardado (ao trocar a lista e depois que o celular reinicia) */
    static synchronized void scheduleSaved(Context ctx) {
        JSONArray items = saved(ctx);
        long now = System.currentTimeMillis();
        for (int i = 0; i < items.length(); i++) {
            JSONObject it = items.optJSONObject(i);
            if (it == null || it.optLong("at") <= now) continue;
            set(ctx, it.optString("id"), it.optLong("at"), it.optString("title"), it.optString("body"), it.optString("icon"));
        }
    }

    static void scheduleOne(Context ctx, String id, long at, String title, String body, String icon) { set(ctx, id, at, title, body, icon == null ? "" : icon); }

    static int count(Context ctx) { return saved(ctx).length(); }

    private static void set(Context ctx, String id, long at, String title, String body, String icon) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        PendingIntent pi = PendingIntent.getBroadcast(ctx, id.hashCode(), intent(ctx, id, title, body).putExtra("icon", icon),
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        if (canExact(ctx)) {
            // aparece como despertador no sistema e acorda o celular mesmo em economia de bateria
            Intent open = new Intent(ctx, MainActivity.class);
            PendingIntent show = PendingIntent.getActivity(ctx, 1, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            am.setAlarmClock(new AlarmManager.AlarmClockInfo(at, show), pi);
        } else {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi); // sem a permissão de alarme exato: pode atrasar alguns minutos
        }
    }

    private static Intent intent(Context ctx, String id, String title, String body) {
        return new Intent(ctx, AlarmReceiver.class).setAction("br.com.startingpro.gametask.ALARM." + id)
            .putExtra("id", id).putExtra("title", title).putExtra("body", body);
    }

    private static PendingIntent pending(Context ctx, String id, String title, String body) {
        return PendingIntent.getBroadcast(ctx, id.hashCode(), intent(ctx, id, title, body), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static void cancelAll(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        JSONArray items = saved(ctx);
        for (int i = 0; i < items.length(); i++) {
            JSONObject it = items.optJSONObject(i);
            if (it == null) continue;
            am.cancel(pending(ctx, it.optString("id"), it.optString("title"), it.optString("body")));
        }
    }

    private static JSONArray saved(Context ctx) {
        try { return new JSONArray(prefs(ctx).getString(KEY, "[]")); } catch (Exception e) { return new JSONArray(); }
    }

    private static SharedPreferences prefs(Context ctx) { return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }
}
