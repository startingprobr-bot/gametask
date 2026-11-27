package br.com.startingpro.gametask;

import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;

/** "Tum": batida grave e curta (gerada aqui) para os últimos segundos do tempo de tela. Toca por cima do jogo, sem pausá-lo. */
public class Thump {
    private static final int RATE = 22050;
    private static byte[] pcm;

    private static synchronized byte[] sound() {
        if (pcm != null) return pcm;
        int n = RATE * 18 / 100; // 180 ms
        pcm = new byte[n * 2];
        double phase = 0;
        for (int i = 0; i < n; i++) {
            double t = (double) i / n;
            double f = 190 - 90 * t;                 // cai de 190 para 100 Hz: soa como "tum"
            phase += 2 * Math.PI * f / RATE;
            double env = Math.min(1, i / (RATE * 0.004)) * Math.exp(-5.5 * t);
            short v = (short) (Math.sin(phase) * env * 30000);
            pcm[2 * i] = (byte) (v & 0xff);
            pcm[2 * i + 1] = (byte) ((v >> 8) & 0xff);
        }
        return pcm;
    }

    static void play() {
        new Thread(() -> {
            try {
                byte[] d = sound();
                AudioTrack t = new AudioTrack.Builder()
                    .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
                    .setAudioFormat(new AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT).setSampleRate(RATE).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
                    .setBufferSizeInBytes(d.length).setTransferMode(AudioTrack.MODE_STATIC).build();
                t.write(d, 0, d.length);
                t.play();
                Thread.sleep(260);
                t.release();
            } catch (Exception ignored) { }
        }).start();
    }
}
