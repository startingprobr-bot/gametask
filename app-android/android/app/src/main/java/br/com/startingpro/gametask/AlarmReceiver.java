package br.com.startingpro.gametask;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/** Chega a hora: liga o serviço que toca o alarme. Depois de reiniciar o celular, remarca tudo. */
public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        String action = intent.getAction() == null ? "" : intent.getAction();
        if (action.equals(Intent.ACTION_BOOT_COMPLETED) || action.equals("android.intent.action.MY_PACKAGE_REPLACED")
            || action.equals("android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED")) {
            AlarmScheduler.scheduleSaved(ctx);
            return;
        }
        Intent s = new Intent(ctx, AlarmService.class)
            .putExtra("title", intent.getStringExtra("title"))
            .putExtra("body", intent.getStringExtra("body"));
        try {
            if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(s); else ctx.startService(s);
        } catch (Exception e) { // sistema barrou o serviço: abre a tela do alarme direto
            Intent a = new Intent(ctx, AlarmActivity.class).putExtra("title", intent.getStringExtra("title")).putExtra("body", intent.getStringExtra("body"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try { ctx.startActivity(a); } catch (Exception ignored) { }
        }
    }
}
