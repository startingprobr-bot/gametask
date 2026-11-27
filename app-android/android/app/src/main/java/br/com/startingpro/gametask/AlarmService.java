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
 * Toca o toque do GameTask pelo canal de ALARME (não o de notificação),
 * por isso toca mesmo com o celular no silencioso ou no vibrar. Para sozinho em 3 minutos.
 */
public class AlarmService extends Service {
    static final String CHANNEL = "gt_alarm", STOP = "br.com.startingpro.gametask.STOP";
    private static final int NOTIF = 4242;
    private MediaPlayer player;
    private Vibrator vibrator;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private String speech = "";
    private boolean endAlarm;
    private boolean on;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && STOP.equals(intent.getAction())) { stopSelf(); return START_NOT_STICKY; }
        String title = intent != null && intent.getStringExtra("title") != null ? intent.getStringExtra("title") : "GameTask";
        String body = intent != null && intent.getStringExtra("body") != null ? intent.getStringExtra("body") : "";

        channel();
        String call = intent != null ? intent.getStringExtra("call") : null;
        String dk = intent != null ? intent.getStringExtra("dk") : null;
        endAlarm = dk != null && dk.startsWith("tu"); // fim do tempo de tela: usa o som escolhido pela família
        Intent full = new Intent(this, call != null ? CallActivity.class : AlarmActivity.class).putExtra("call", call).putExtra("title", title).putExtra("body", body).putExtra("icon", intent != null ? intent.getStringExtra("icon") : null)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent fullPi = PendingIntent.getActivity(this, 2, full, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        PendingIntent stopPi = PendingIntent.getService(this, 3, new Intent(this, AlarmService.class).setAction(STOP), PendingIntent.FLAG_IMMUTABLE);
        Notification n = new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_gt).setColor(0xFF2A6CF0)
            .setContentTitle(title).setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_MAX).setCategory(NotificationCompat.CATEGORY_ALARM)
            .setFullScreenIntent(fullPi, true).setContentIntent(fullPi)
            .setOngoing(true).setAutoCancel(false)
            .addAction(0, "Desligar", stopPi)
            .build();
        if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIF, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        else startForeground(NOTIF, n);

        // com o app aberto na tela, o Android só mostra uma faixa: abre a tela do alarme por cima, com o Desligar
        try { startActivity(full); } catch (Exception ignored) { }
        speech = call != null ? title : body.isEmpty() ? title : title + ". " + body;
        on = true;
        handler.removeCallbacksAndMessages(null);
        louder();
        vibrate();
        cycle();
        handler.postDelayed(this::stopSelf, call != null ? 45 * 1000 : 3 * 60 * 1000); // ligação toca 45 s
        return START_NOT_STICKY;
    }

    // toca o toque uma vez, fala o que é para fazer, espera um pouco e repete (até desligar ou 3 minutos)
    private void cycle() {
        if (!on) return;
        releasePlayer();
        try {
            Uri uri = Uri.parse("android.resource://" + getPackageName() + "/" + R.raw.gt_alarm); // toque próprio do GameTask
            player = new MediaPlayer();
            player.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            java.io.File mine = new java.io.File(getFilesDir(), "end_sound");
            if (endAlarm && mine.exists()) { try { player.setDataSource(mine.getAbsolutePath()); } catch (Exception e) { player.reset(); player.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build()); player.setDataSource(this, uri); } }
            else player.setDataSource(this, uri);
            player.setOnCompletionListener(mp -> Speaker.say(this, speech, () -> handler.postDelayed(this::cycle, 900)));
            player.prepare();
            player.start();
        } catch (Exception e) {
            Speaker.say(this, speech, () -> handler.postDelayed(this::cycle, 1500));
        }
    }

    // se o volume de alarme estiver baixo, sobe para um nível audível
    private void louder() {
        try {
            AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            int max = am.getStreamMaxVolume(AudioManager.STREAM_ALARM);
            if (am.getStreamVolume(AudioManager.STREAM_ALARM) < max / 2) am.setStreamVolume(AudioManager.STREAM_ALARM, (int) Math.ceil(max * 0.7), 0);
        } catch (Exception ignored) { }
    }

    private void vibrate() {
        try {
            vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            long[] p = { 0, 600, 300, 600, 300, 600, 1200 };
            if (Build.VERSION.SDK_INT >= 26) vibrator.vibrate(VibrationEffect.createWaveform(p, 0)); else vibrator.vibrate(p, 0);
        } catch (Exception ignored) { }
    }

    private void releasePlayer() {
        if (player != null) { try { player.stop(); } catch (Exception ignored) { } player.release(); player = null; }
    }

    private void stopSound() {
        on = false;
        Speaker.stop();
        releasePlayer();
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
