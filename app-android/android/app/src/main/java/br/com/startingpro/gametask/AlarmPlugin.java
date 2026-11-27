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
        android.os.PowerManager pm = (android.os.PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
        r.put("battery", pm.isIgnoringBatteryOptimizations(ctx.getPackageName()));
        r.put("xiaomi", "xiaomi".equalsIgnoreCase(Build.MANUFACTURER) || "redmi".equalsIgnoreCase(Build.BRAND) || "poco".equalsIgnoreCase(Build.BRAND));
        r.put("scheduled", AlarmScheduler.count(ctx));
        call.resolve(r);
    }

    /** Endereço deste celular no Firebase, para o servidor mandar recados com o app fechado */
    @PluginMethod
    public void fcmToken(PluginCall call) {
        try {
            com.google.firebase.messaging.FirebaseMessaging.getInstance().getToken().addOnCompleteListener(t -> {
                if (!t.isSuccessful() || t.getResult() == null) { call.reject("Sem token do Firebase"); return; }
                JSObject r = new JSObject(); r.put("token", t.getResult()); call.resolve(r);
            });
        } catch (Exception e) { call.reject("Firebase indisponível"); }
    }

    // ---------- Bloqueio de apps ----------
    /** Permissões do bloqueio: Acesso ao uso e Sobrepor a outros apps */
    @PluginMethod
    public void blockCheck(PluginCall call) {
        Context ctx = getContext();
        JSObject r = new JSObject();
        android.app.AppOpsManager ops = (android.app.AppOpsManager) ctx.getSystemService(Context.APP_OPS_SERVICE);
        int mode = Build.VERSION.SDK_INT >= 29 ? ops.unsafeCheckOpNoThrow(android.app.AppOpsManager.OPSTR_GET_USAGE_STATS, android.os.Process.myUid(), ctx.getPackageName())
            : ops.checkOpNoThrow(android.app.AppOpsManager.OPSTR_GET_USAGE_STATS, android.os.Process.myUid(), ctx.getPackageName());
        r.put("usage", mode == android.app.AppOpsManager.MODE_ALLOWED);
        r.put("overlay", Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(ctx));
        r.put("on", BlockStore.enabled(ctx));
        r.put("pin", BlockStore.hasPin(ctx));
        r.put("groups", BlockStore.groups(ctx));
        BlockService.sync(ctx); // garante o vigia ligado quando o bloqueio está ativo
        call.resolve(r);
    }

    /** Apps que aparecem na tela inicial: nome, pacote e ícone pequeno */
    @PluginMethod
    public void listApps(PluginCall call) {
        android.content.pm.PackageManager pm = getContext().getPackageManager();
        Intent main = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
        JSArray out = new JSArray();
        java.util.Set<String> seen = new java.util.HashSet<>();
        for (android.content.pm.ResolveInfo ri : pm.queryIntentActivities(main, 0)) {
            String pkg = ri.activityInfo.packageName;
            if (pkg.equals(getContext().getPackageName()) || !seen.add(pkg)) continue;
            JSObject a = new JSObject();
            a.put("pkg", pkg);
            a.put("label", String.valueOf(ri.loadLabel(pm)));
            try {
                android.graphics.drawable.Drawable d = ri.loadIcon(pm);
                android.graphics.Bitmap bmp = android.graphics.Bitmap.createBitmap(64, 64, android.graphics.Bitmap.Config.ARGB_8888);
                android.graphics.Canvas cv = new android.graphics.Canvas(bmp);
                d.setBounds(0, 0, 64, 64); d.draw(cv);
                java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();
                bmp.compress(android.graphics.Bitmap.CompressFormat.PNG, 90, bo);
                a.put("icon", "data:image/png;base64," + android.util.Base64.encodeToString(bo.toByteArray(), android.util.Base64.NO_WRAP));
            } catch (Exception ignored) { }
            out.put(a);
        }
        JSObject r = new JSObject(); r.put("apps", out); call.resolve(r);
    }

    /** Salva as regras: on, groups {pacote: game|video|always|free}, pin (opcional) */
    @PluginMethod
    public void blockSave(PluginCall call) {
        Context ctx = getContext();
        JSObject g = call.getObject("groups", new JSObject());
        String pin = call.getString("pin", "");
        BlockStore.save(ctx, call.getBoolean("on", false), g.toString(), pin.isEmpty() ? null : BlockStore.sha(pin));
        BlockService.sync(ctx);
        call.resolve();
    }

    /** Até quando cada grupo está liberado: { game: ms, video: ms } (vem do cronômetro do tempo de tela) */
    @PluginMethod
    public void blockAllow(PluginCall call) {
        BlockStore.setAllowed(getContext(), call.getObject("allowed", new JSObject()).toString());
        if (call.hasOption("kid")) BlockStore.setKid(getContext(), call.getInt("kid", 0), call.getObject("map", new JSObject()).toString());
        if (call.hasOption("ends")) BlockStore.setWarn(getContext(), call.getLong("ends", 0L), call.getString("etitle", ""));
        BlockService.sync(getContext()); // liga ou desliga o vigia conforme precisar
        BlockService.poll(getContext()); // confere com o servidor logo depois de mudar a criança ou o mapa
        call.resolve();
    }

    // ---------- Som do fim do tempo escolhido pela família ----------
    @PluginMethod
    public void soundSet(PluginCall call) {
        try {
            byte[] b = android.util.Base64.decode(call.getString("data", ""), android.util.Base64.DEFAULT);
            if (b.length < 200 || b.length > 1024 * 1024) { call.reject("Arquivo inválido"); return; }
            java.io.File f = new java.io.File(getContext().getFilesDir(), "end_sound");
            try (java.io.FileOutputStream o = new java.io.FileOutputStream(f)) { o.write(b); }
            call.resolve();
        } catch (Exception e) { call.reject("Não deu para guardar o som"); }
    }

    @PluginMethod
    public void soundClear(PluginCall call) { new java.io.File(getContext().getFilesDir(), "end_sound").delete(); call.resolve(); }

    // ---------- Digital (biometria do Android) ----------
    /** available: há digital/rosto cadastrado; enrolled: o painel já está ligado à digital neste aparelho */
    @PluginMethod
    public void bioCheck(PluginCall call) {
        JSObject r = new JSObject();
        r.put("available", Bio.available(getContext()));
        r.put("none", Bio.noneEnrolled(getContext()));
        r.put("enrolled", !Bio.token(getContext()).isEmpty());
        call.resolve(r);
    }

    /** Pede a digital e guarda a chave do painel (token) neste aparelho */
    @PluginMethod
    public void bioSave(PluginCall call) {
        String token = call.getString("token", "");
        if (token.isEmpty()) { call.reject("Sem chave"); return; }
        getActivity().runOnUiThread(() -> Bio.prompt((androidx.fragment.app.FragmentActivity) getActivity(), "Ativar a digital", "Confirme com a sua digital",
            () -> { Bio.save(getContext(), token); call.resolve(); }, (msg) -> call.reject(msg)));
    }

    /** Pede a digital e devolve a chave do painel */
    @PluginMethod
    public void bioGet(PluginCall call) {
        String token = Bio.token(getContext());
        if (token.isEmpty()) { call.reject("Digital não ativada neste aparelho"); return; }
        getActivity().runOnUiThread(() -> Bio.prompt((androidx.fragment.app.FragmentActivity) getActivity(), "Painel dos pais", "Use a sua digital para entrar",
            () -> { JSObject r = new JSObject(); r.put("token", token); call.resolve(r); }, (msg) -> call.reject(msg)));
    }

    @PluginMethod
    public void bioClear(PluginCall call) { Bio.save(getContext(), ""); call.resolve(); }

    // ---------- Ligação da família ----------
    /** Ligação atendida ou recusada na tela do Android enquanto o site estava fechado (lê e apaga) */
    @PluginMethod
    public void callPending(PluginCall call) {
        android.content.SharedPreferences p = getContext().getSharedPreferences("gt_call", Context.MODE_PRIVATE);
        JSObject r = new JSObject();
        r.put("answer", p.getString("answer", ""));
        r.put("declined", p.getString("declined", ""));
        p.edit().clear().apply();
        call.resolve(r);
    }

    /** Viva-voz durante a ligação (desligado volta para o modo normal) */
    @PluginMethod
    public void speaker(PluginCall call) {
        android.media.AudioManager am = (android.media.AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        boolean on = call.getBoolean("on", true), end = call.getBoolean("end", false);
        am.setMode(end ? android.media.AudioManager.MODE_NORMAL : android.media.AudioManager.MODE_IN_COMMUNICATION);
        am.setSpeakerphoneOn(!end && on);
        call.resolve();
    }

    /** Fala o texto com a voz do Android (no app, o site não tem voz própria) */
    @PluginMethod
    public void speak(PluginCall call) { Speaker.say(getContext(), call.getString("text", ""), null); call.resolve(); }

    @PluginMethod
    public void stopSpeak(PluginCall call) { Speaker.stop(); call.resolve(); }

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
        } else if ("appinfo".equals(what)) {
            i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + ctx.getPackageName()));
        } else if ("usage".equals(what)) {
            i = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
        } else if ("overlay".equals(what) && Build.VERSION.SDK_INT >= 23) {
            i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + ctx.getPackageName()));
        } else if ("battery".equals(what)) {
            i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + ctx.getPackageName()));
        } else if ("autostart".equals(what)) { // Xiaomi: tela "Início automático"
            i = new Intent().setComponent(new android.content.ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"));
        } else if ("fullScreen".equals(what) && Build.VERSION.SDK_INT >= 34) {
            i = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:" + ctx.getPackageName()));
        } else {
            i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, ctx.getPackageName());
        }
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        BlockStore.settingsGrace(ctx, 3 * 60 * 1000); // o responsável está nas configurações pelo GameTask: só elas ficam livres
        try { ctx.startActivity(i); }
        catch (Exception e) { // tela da marca não existe: abre os detalhes do app
            try { ctx.startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + ctx.getPackageName())).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); }
            catch (Exception e2) { call.reject("Não deu para abrir as configurações"); return; }
        }
        call.resolve();
    }

    /** Toca um alarme de teste daqui a alguns segundos */
    @PluginMethod
    public void test(PluginCall call) {
        int secs = call.getInt("seconds", 5);
        String title = call.getString("title", "Teste do alarme do GameTask");
        AlarmScheduler.scheduleOne(getContext(), "teste", System.currentTimeMillis() + secs * 1000L, title, "Se você está ouvindo, está funcionando.", call.getString("icon", ""));
        call.resolve();
    }
}
