package br.com.startingpro.gametask;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;

/**
 * Vigia do bloqueio de apps: a cada segundo vê qual app está na tela (Acesso ao uso)
 * e, se for um app bloqueado agora, abre a tela de bloqueio do GameTask por cima (Sobrepor a outros apps).
 */
public class BlockService extends Service {
    private static final String CH = "gt_block";
    private static final int NOTIF = 4343;
    private final Handler h = new Handler(Looper.getMainLooper());
    private String current = "";
    private long lastShown = 0, lastPoll = 0;
    private volatile boolean polling = false;
    static final String BASE = "https://gametask.startingpro.com.br";

    /** pede uma conferência imediata (aviso do Firebase: alguém pausou, começou ou bloqueou) */
    static void poll(Context c) {
        if (!BlockStore.enabled(c)) return;
        try { c.startService(new Intent(c, BlockService.class).setAction("POLL")); } catch (Exception ignored) { }
    }

    static void sync(Context c) {
        Intent i = new Intent(c, BlockService.class);
        if (!BlockStore.enabled(c)) { c.stopService(i); return; }
        try { if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i); } catch (Exception ignored) { }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && "POLL".equals(intent.getAction()) && lastPoll > 0) { lastPoll = 0; return START_STICKY; } // só adianta a próxima conferência
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm.getNotificationChannel(CH) == null) {
                NotificationChannel c = new NotificationChannel(CH, "Bloqueio de apps", NotificationManager.IMPORTANCE_MIN);
                c.setDescription("Mostra que o GameTask está cuidando do tempo de tela");
                nm.createNotificationChannel(c);
            }
        }
        PendingIntent open = PendingIntent.getActivity(this, 7, new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE);
        Notification n = new NotificationCompat.Builder(this, CH).setSmallIcon(R.drawable.ic_stat_gt).setColor(0xFF2A6CF0)
            .setContentTitle("GameTask cuidando do tempo de tela").setContentText("Jogos e vídeos liberam com o tempo ganho nas missões.")
            .setOngoing(true).setPriority(NotificationCompat.PRIORITY_MIN).setContentIntent(open).build();
        if (Build.VERSION.SDK_INT >= 34) startForeground(NOTIF, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        else startForeground(NOTIF, n);
        h.removeCallbacksAndMessages(null);
        h.post(tick);
        return START_STICKY;
    }

    private final Runnable tick = new Runnable() {
        @Override public void run() {
            if (!BlockStore.enabled(BlockService.this)) { stopSelf(); return; }
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (pm.isInteractive()) check();
            if (System.currentTimeMillis() - lastPoll > 6000) { lastPoll = System.currentTimeMillis(); askServer(); }
            h.postDelayed(this, 900);
        }
    };

    private void check() {
        String top = foreground();
        if (top != null) {
            current = top;
            // saiu do app liberado com o PIN (foi para outro app ou para a tela inicial): bloqueia de novo
            String un = BlockStore.unlocked(this);
            if (!un.isEmpty() && !top.equals(un) && !top.equals(getPackageName()) && !top.equals("com.android.systemui")) BlockStore.unlock(this, "");
        }
        String g = BlockStore.blockedGroup(this, current);
        if (g == null) return;
        long now = System.currentTimeMillis();
        if (now - lastShown < 1500) return; // não reabre em cima dela mesma
        lastShown = now;
        Intent b = new Intent(this, BlockActivity.class).putExtra("group", g).putExtra("pkg", current)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NO_ANIMATION);
        try { startActivity(b); } catch (Exception ignored) { }
    }

    /**
     * Pergunta ao servidor como está o tempo de tela da criança deste aparelho (usa o login do próprio app).
     * Se alguém pausou o cronômetro em outro aparelho, ou os pais bloquearam, o bloqueio volta aqui em poucos segundos,
     * mesmo com o GameTask fechado ou em segundo plano.
     */
    private void askServer() {
        final long kid = BlockStore.kid(this);
        if (kid <= 0 || polling) return;
        polling = true;
        final Context ctx = getApplicationContext();
        new Thread(() -> {
            java.net.HttpURLConnection c = null;
            try {
                String cookie = android.webkit.CookieManager.getInstance().getCookie(BASE);
                if (cookie == null || cookie.isEmpty()) return;
                c = (java.net.HttpURLConnection) new java.net.URL(BASE + "/api/kids/" + kid + "/screen").openConnection();
                c.setConnectTimeout(6000); c.setReadTimeout(8000);
                c.setRequestProperty("Cookie", cookie);
                if (c.getResponseCode() != 200) return;
                java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();
                try (java.io.InputStream in = c.getInputStream()) { byte[] b = new byte[2048]; int n; while ((n = in.read(b)) > 0) bo.write(b, 0, n); }
                org.json.JSONObject r = new org.json.JSONObject(bo.toString("UTF-8"));
                BlockStore.setLocked(ctx, r.optBoolean("locked", false));
                org.json.JSONObject map = BlockStore.map(ctx), allowed = new org.json.JSONObject();
                org.json.JSONArray run = r.optJSONArray("running");
                long now = System.currentTimeMillis();
                for (int i = 0; run != null && i < run.length(); i++) {
                    org.json.JSONObject x = run.getJSONObject(i);
                    String g = map.optString(String.valueOf(x.optInt("reward_id")), "");
                    if (!g.isEmpty()) allowed.put(g, Math.max(allowed.optLong(g, 0), now + x.optLong("secs") * 1000));
                }
                BlockStore.setAllowed(ctx, allowed.toString()); // verdade do servidor: se pausou em outro lugar, some daqui também
            } catch (Exception ignored) {
            } finally {
                if (c != null) c.disconnect();
                polling = false;
            }
        }).start();
    }

    /** último app que veio para a frente nos últimos segundos */
    private String foreground() {
        UsageStatsManager um = (UsageStatsManager) getSystemService(USAGE_STATS_SERVICE);
        long end = System.currentTimeMillis();
        UsageEvents ev = um.queryEvents(end - 10000, end);
        String last = null;
        UsageEvents.Event e = new UsageEvents.Event();
        while (ev.hasNextEvent()) {
            ev.getNextEvent(e);
            if (e.getEventType() == UsageEvents.Event.ACTIVITY_RESUMED) last = e.getPackageName();
        }
        return last;
    }

    @Override public void onDestroy() { h.removeCallbacksAndMessages(null); super.onDestroy(); }

    @Override public IBinder onBind(Intent i) { return null; }
}
