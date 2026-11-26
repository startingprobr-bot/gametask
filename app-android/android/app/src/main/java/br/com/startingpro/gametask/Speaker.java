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

    static synchronized void say(Context ctx, String text, Runnable done) {
        if (text == null || text.trim().isEmpty()) { if (done != null) done.run(); return; }
        if (tts == null) {
            pending = text; pendingDone = done;
            tts = new TextToSpeech(ctx.getApplicationContext(), status -> {
                synchronized (Speaker.class) {
                    ready = status == TextToSpeech.SUCCESS;
                    if (ready) {
                        tts.setLanguage(new Locale("pt", "BR"));
                        tts.setAudioAttributes(new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build());
                    }
                    if (pending != null) { String p = pending; Runnable d = pendingDone; pending = null; pendingDone = null; speak(p, d); }
                }
            });
            return;
        }
        if (!ready) { pending = text; pendingDone = done; return; }
        speak(text, done);
    }

    private static void speak(String text, Runnable done) {
        if (!ready) { if (done != null) done.run(); return; }
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String id) { }
            @Override public void onDone(String id) { if (done != null) done.run(); }
            @Override public void onError(String id) { if (done != null) done.run(); }
        });
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, new Bundle(), "gt");
    }

    static synchronized void stop() { if (tts != null) tts.stop(); pending = null; pendingDone = null; }
}
