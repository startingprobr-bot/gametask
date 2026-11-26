package br.com.startingpro.gametask;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;

import androidx.core.app.NotificationCompat;

/**
 * Toca o som de despertador do celular pelo canal de ALARME (não o de notificação),
 * por isso toca mesmo com o celular no silencioso ou no vibrar. Para sozinho em 3 minutos.
 */
public class AlarmService extends Service {
    static final String CHANNEL = "gt_alarm", STOP = "br.com.startingpro.gametask.STOP";
    private static final int NOTIF = 4242;
    private MediaPlayer player;
    private Vibrator vibrator;
    private final Handler handler = new Handler(Looper.getMainLooper());

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && STOP.equals(intent.getAction())) { stopSelf(); return START_NOT_STICKY; }
        String title = intent != null && intent.getStringExtra("title") != null ? intent.getStringExtra("title") : "GameTask";
        String body = intent != null && intent.getStringExtra("body") != null ? intent.getStringExtra("body") : "";

        channel();
        Intent full = new Intent(this, AlarmActivity.class).putExtra("title", title).putExtra("body", body)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent fullPi = PendingIntent.getActivity(this, 2, full, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        PendingIntent stopPi = PendingIntent.getService(this, 3, new Intent(this, AlarmService.class).setAction(STOP), PendingIntent.FLAG_IMMUTABLE);
        Notification n = new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title).setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_MAX).setCategory(NotificationCompat.CATEGORY_ALARM)
            .setFullScreenIntent(fullPi, true).setContentIntent(fullPi)
            .setOngoing(true).setAutoCancel(false)
            .addAction(0, "Desligar", stopPi)
            .build();
        if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIF, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        else startForeground(NOTIF, n);

        play();
        handler.removeCallbacksAndMessages(null);
        handler.postDelayed(this::stopSelf, 3 * 60 * 1000);
        return START_NOT_STICKY;
    }

    private void play() {
        stopSound();
        try {
            Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (uri == null) uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            player = new MediaPlayer();
            player.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            player.setDataSource(this, uri);
            player.setLooping(true);
            // se o volume de alarme estiver no zero, sobe para um nível audível
            AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            int max = am.getStreamMaxVolume(AudioManager.STREAM_ALARM);
            if (am.getStreamVolume(AudioManager.STREAM_ALARM) < max / 2) am.setStreamVolume(AudioManager.STREAM_ALARM, (int) Math.ceil(max * 0.7), 0);
            player.prepare();
            player.start();
        } catch (Exception ignored) { }
        try {
            vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            long[] p = { 0, 600, 300, 600, 300, 600, 1200 };
            if (Build.VERSION.SDK_INT >= 26) vibrator.vibrate(VibrationEffect.createWaveform(p, 0)); else vibrator.vibrate(p, 0);
        } catch (Exception ignored) { }
    }

    private void stopSound() {
        if (player != null) { try { player.stop(); } catch (Exception ignored) { } player.release(); player = null; }
        if (vibrator != null) { vibrator.cancel(); vibrator = null; }
    }

    private void channel() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm.getNotificationChannel(CHANNEL) != null) return;
        NotificationChannel c = new NotificationChannel(CHANNEL, "Alarmes do GameTask", NotificationManager.IMPORTANCE_HIGH);
        c.setDescription("Avisos com hora marcada e fim do tempo de tela");
        c.setSound(null, null); // o som sai pelo serviço, no canal de alarme
        c.setBypassDnd(true);
        c.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(c);
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        stopSound();
        sendBroadcast(new Intent(AlarmActivity.CLOSE).setPackage(getPackageName()));
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
