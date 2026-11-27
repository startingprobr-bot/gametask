package br.com.startingpro.gametask;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * Aviso que chega pelo Firebase com o app fechado.
 * type=alarm (recado, fim do tempo de tela): toca e fala como despertador.
 * type=note (pedido de aprovação, resposta de recado): notificação comum com som.
 */
public class GtMessagingService extends FirebaseMessagingService {
    static final String NOTE = "gt_note";

    @Override
    public void onMessageReceived(RemoteMessage msg) {
        Map<String, String> d = msg.getData();
        if ("screen".equals(d.get("type"))) { BlockService.poll(this); return; } // alguém mexeu no tempo de tela: confere agora
        String title = d.get("title") != null ? d.get("title") : "GameTask";
        String body = d.get("body") != null ? d.get("body") : "";
        boolean call = "call".equals(d.get("type"));
        String tag = d.get("tag");
        if ("alarm".equals(d.get("type")) && tag != null && tag.startsWith("tu") && !BlockStore.firstRing(this, tag)) return; // fim do tempo: já tocou aqui
        if ("alarm".equals(d.get("type")) || call) {
            Intent s = new Intent(this, AlarmService.class).putExtra("title", title).putExtra("body", body).putExtra("icon", d.get("icon")).putExtra("dk", tag);
            if (call) s.putExtra("call", d.get("call")); // ligação da família: toca com Atender e Recusar
            try {
                if (Build.VERSION.SDK_INT >= 26) startForegroundService(s); else startService(s);
                return;
            } catch (Exception ignored) { } // sistema barrou: cai na notificação comum
        }
        note(title, body, d.get("tag"));
    }

    private void note(String title, String body, String tag) {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(NOTE) == null) {
            NotificationChannel c = new NotificationChannel(NOTE, "Avisos do GameTask", NotificationManager.IMPORTANCE_HIGH);
            c.setDescription("Pedidos de aprovação e respostas de recados");
            nm.createNotificationChannel(c);
        }
        PendingIntent open = PendingIntent.getActivity(this, 5, new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        nm.notify(tag != null ? tag : "gt", 1, new NotificationCompat.Builder(this, NOTE)
            .setSmallIcon(R.drawable.ic_stat_gt).setColor(0xFF2A6CF0).setContentTitle(title).setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH).setAutoCancel(true).setContentIntent(open).build());
    }

    @Override
    public void onNewToken(String token) {
        // o site registra de novo na próxima vez que o app abrir (fcmToken)
        getSharedPreferences("gt_alarms", MODE_PRIVATE).edit().putString("fcm", token).apply();
    }
}
