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
    private long lastShown = 0;

    static void sync(Context c) {
        Intent i = new Intent(c, BlockService.class);
        if (!BlockStore.enabled(c)) { c.stopService(i); return; }
        try { if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i); } catch (Exception ignored) { }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
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
            h.postDelayed(this, 900);
        }
    };

    private void check() {
        String top = foreground();
        if (top != null) current = top;
        String g = BlockStore.blockedGroup(this, current);
        if (g == null) return;
        long now = System.currentTimeMillis();
        if (now - lastShown < 1500) return; // não reabre em cima dela mesma
        lastShown = now;
        Intent b = new Intent(this, BlockActivity.class).putExtra("group", g).putExtra("pkg", current)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NO_ANIMATION);
        try { startActivity(b); } catch (Exception ignored) { }
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
