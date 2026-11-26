package br.com.startingpro.gametask;

import android.content.Context;

import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import java.util.function.Consumer;

/**
 * Digital ou rosto do Android. Vale qualquer digital cadastrada no aparelho
 * (no tablet das crianças, cadastre só as dos responsáveis).
 */
public class Bio {
    private static final int KIND = BiometricManager.Authenticators.BIOMETRIC_WEAK;

    static boolean available(Context c) { return BiometricManager.from(c).canAuthenticate(KIND) == BiometricManager.BIOMETRIC_SUCCESS; }

    static boolean noneEnrolled(Context c) { return BiometricManager.from(c).canAuthenticate(KIND) == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED; }

    static String token(Context c) { return c.getSharedPreferences("gt_bio", Context.MODE_PRIVATE).getString("token", ""); }

    static void save(Context c, String t) { c.getSharedPreferences("gt_bio", Context.MODE_PRIVATE).edit().putString("token", t).apply(); }

    static void prompt(FragmentActivity a, String title, String sub, Runnable ok, Consumer<String> fail) {
        BiometricPrompt p = new BiometricPrompt(a, ContextCompat.getMainExecutor(a), new BiometricPrompt.AuthenticationCallback() {
            @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult r) { ok.run(); }
            @Override public void onAuthenticationError(int code, CharSequence msg) { fail.accept(code == BiometricPrompt.ERROR_NEGATIVE_BUTTON || code == BiometricPrompt.ERROR_USER_CANCELED ? "Cancelado" : String.valueOf(msg)); }
        });
        p.authenticate(new BiometricPrompt.PromptInfo.Builder().setTitle(title).setSubtitle(sub)
            .setAllowedAuthenticators(KIND).setNegativeButtonText("Usar o PIN").build());
    }
}
