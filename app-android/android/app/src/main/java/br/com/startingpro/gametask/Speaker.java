package br.com.startingpro.gametask;

import android.content.Context;
import android.media.AudioAttributes;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;

import java.util.Locale;

/** Voz do Android em português, pelo volume de alarme (fala mesmo no silencioso). */
public class Speaker {
    private static TextToSpeech tts;
    private static boolean ready;
    private static String pending;
    private static Runnable pendingDone;

    private static boolean loudNow = true;

    /** Alarmes e avisos: pelo volume de alarme (tocam até no silencioso) */
    static void say(Context ctx, String text, Runnable done) { say(ctx, text, done, true); }

    /** loud = true: volume de alarme; false: volume de mídia (ler a tarefa para a criança) */
    static synchronized void say(Context ctx, String text, Runnable done, boolean loud) {
        if (text == null || text.trim().isEmpty()) { if (done != null) done.run(); return; }
        loudNow = loud;
        if (tts == null) {
            pending = text; pendingDone = done;
            tts = new TextToSpeech(ctx.getApplicationContext(), status -> {
                synchronized (Speaker.class) {
                    ready = status == TextToSpeech.SUCCESS;
                    if (ready) tts.setLanguage(new Locale("pt", "BR"));
                    else tts = null; // a voz não iniciou: tenta de novo na próxima vez
                    if (pending != null) { String p = pending; Runnable d = pendingDone; pending = null; pendingDone = null; speak(p, d); }
                }
            });
            return;
        }
        if (!ready) { pending = text; pendingDone = done; return; }
        speak(text, done);
    }

    static boolean isReady() { return tts != null && ready; }

    private static void speak(String text, Runnable done) {
        if (!ready || tts == null) { ready = false; if (done != null) done.run(); return; }
        tts.setAudioAttributes(new AudioAttributes.Builder()
            .setUsage(loudNow ? AudioAttributes.USAGE_ALARM : AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build());
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String id) { }
            @Override public void onDone(String id) { if (done != null) done.run(); }
            @Override public void onError(String id) { if (done != null) done.run(); }
        });
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, new Bundle(), "gt");
    }

    static synchronized void stop() { if (tts != null) tts.stop(); pending = null; pendingDone = null; }
}
