package br.com.startingpro.gametask;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Collection;

/** Personagens das crianças guardados no celular, para a tela do alarme mostrar mesmo sem internet. */
public class AvatarCache {
    private static final String BASE = "https://gametask.startingpro.com.br/img/3d/";

    static boolean valid(String slug) { return slug != null && slug.matches("[a-z0-9_-]{1,40}"); }

    static File file(Context ctx, String slug) { return new File(ctx.getFilesDir(), "av_" + slug + ".png"); }

    /** Bitmap guardado (ou baixa agora, se tiver internet). Null se não der. Não chamar na thread da tela. */
    static Bitmap load(Context ctx, String slug) {
        if (!valid(slug)) return null;
        File f = file(ctx, slug);
        if (!f.exists()) download(ctx, slug);
        return f.exists() ? BitmapFactory.decodeFile(f.getAbsolutePath()) : null;
    }

    /** Baixa em segundo plano os personagens que ainda não estão guardados */
    static void prefetch(Context ctx, Collection<String> slugs) {
        Context app = ctx.getApplicationContext();
        new Thread(() -> { for (String s : slugs) if (valid(s) && !file(app, s).exists()) download(app, s); }).start();
    }

    private static synchronized void download(Context ctx, String slug) {
        HttpURLConnection c = null;
        File tmp = new File(ctx.getFilesDir(), "av_" + slug + ".tmp");
        try {
            c = (HttpURLConnection) new URL(BASE + slug + ".png").openConnection();
            c.setConnectTimeout(6000); c.setReadTimeout(8000);
            if (c.getResponseCode() != 200) return;
            try (InputStream in = c.getInputStream(); FileOutputStream out = new FileOutputStream(tmp)) {
                byte[] buf = new byte[8192]; int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            }
            if (!tmp.renameTo(file(ctx, slug))) tmp.delete();
        } catch (Exception ignored) {
            tmp.delete();
        } finally { if (c != null) c.disconnect(); }
    }
}
