package br.com.startingpro.gametask;

import android.Manifest;
import android.app.AlarmManager;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;

/**
 * Ponte entre o site do GameTask e o alarme do Android.
 * O site manda a lista de alarmes dos próximos dias (sync); o app marca cada um como despertador.
 */
@CapacitorPlugin(name = "GtAlarm", permissions = {
    @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
})
public class AlarmPlugin extends Plugin {

    /** items: [{ id, at (ms), title, body }] — substitui tudo que estava marcado */
    @PluginMethod
    public void sync(PluginCall call) {
        JSArray items = call.getArray("items", new JSArray());
        Context ctx = getContext();
        AlarmScheduler.replace(ctx, items);
        JSObject r = new JSObject();
        r.put("scheduled", AlarmScheduler.count(ctx));
        r.put("exact", AlarmScheduler.canExact(ctx));
        call.resolve(r);
    }

    /** O que falta liberar para o alarme tocar na hora certa e por cima da tela */
    @PluginMethod
    public void check(PluginCall call) {
        Context ctx = getContext();
        JSObject r = new JSObject();
        r.put("exact", AlarmScheduler.canExact(ctx));
        r.put("notifications", Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED);
        boolean fs = true;
        if (Build.VERSION.SDK_INT >= 34) fs = ((NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE)).canUseFullScreenIntent();
        r.put("fullScreen", fs);
        r.put("scheduled", AlarmScheduler.count(ctx));
        call.resolve(r);
    }

    @PluginMethod
    public void askNotifications(PluginCall call) {
        if (Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED) { check(call); return; }
        requestPermissionForAlias("notifications", call, "afterNotif");
    }

    @PermissionCallback
    private void afterNotif(PluginCall call) { check(call); }

    /** Abre a tela do Android para liberar "Alarmes e lembretes" ou "Notificações em tela cheia" */
    @PluginMethod
    public void openSettings(PluginCall call) {
        Context ctx = getContext();
        String what = call.getString("what", "exact");
        Intent i;
        if ("exact".equals(what) && Build.VERSION.SDK_INT >= 31) {
            i = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + ctx.getPackageName()));
        } else if ("fullScreen".equals(what) && Build.VERSION.SDK_INT >= 34) {
            i = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:" + ctx.getPackageName()));
        } else {
            i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, ctx.getPackageName());
        }
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try { ctx.startActivity(i); } catch (Exception e) { call.reject("Não deu para abrir as configurações"); return; }
        call.resolve();
    }

    /** Toca um alarme de teste daqui a alguns segundos */
    @PluginMethod
    public void test(PluginCall call) {
        int secs = call.getInt("seconds", 5);
        String title = call.getString("title", "Teste do alarme do GameTask");
        AlarmScheduler.scheduleOne(getContext(), "teste", System.currentTimeMillis() + secs * 1000L, title, "Se você está ouvindo, está funcionando.");
        call.resolve();
    }
}
