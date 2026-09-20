package in.payshield.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.speech.RecognizerIntent;

import androidx.activity.result.ActivityResult;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.Locale;
import java.util.concurrent.Executor;

@CapacitorPlugin(name = "PayShieldGuard")
public class PayShieldGuardPlugin extends Plugin {
    private volatile long lastStrongAuthenticationAt = 0L;
    private boolean authenticationPending = false;
    @PluginMethod
    public void listen(PluginCall call) {
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-IN");
        intent.putExtra(RecognizerIntent.EXTRA_PROMPT, "Say your protected payment instruction");
        try {
            startActivityForResult(call, intent, "voiceResult");
        } catch (ActivityNotFoundException error) {
            call.reject("No speech recognition service is available on this device.");
        }
    }

    @ActivityCallback
    private void voiceResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("Voice recognition was cancelled.");
            return;
        }
        ArrayList<String> matches = result.getData().getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
        if (matches == null || matches.isEmpty()) {
            call.reject("No speech was recognised.");
            return;
        }
        JSObject response = new JSObject();
        response.put("transcript", matches.get(0));
        call.resolve(response);
    }

    @PluginMethod
    public void authenticate(PluginCall call) {
        getActivity().runOnUiThread(() -> authenticateOnMainThread(call));
    }

    private void authenticateOnMainThread(PluginCall call) {
        if (authenticationPending) {
            call.reject("An identity check is already open. Finish or cancel that check first.");
            return;
        }
        lastStrongAuthenticationAt = 0L;
        FragmentActivity activity = (FragmentActivity) getActivity();
        Executor executor = ContextCompat.getMainExecutor(activity);
        int authenticators = BiometricManager.Authenticators.BIOMETRIC_STRONG;
        int available = BiometricManager.from(activity).canAuthenticate(authenticators);
        if (available != BiometricManager.BIOMETRIC_SUCCESS) {
            String message;
            if (available == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED) {
                message = "No payment-grade biometric is enrolled. Open Android Settings > Security and add a fingerprint or supported face unlock, then try again.";
            } else if (available == BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE) {
                message = "The biometric sensor is temporarily unavailable. Unlock your phone and try again.";
            } else if (available == BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED) {
                message = "Android requires a security update before this biometric sensor can authorize payments.";
            } else {
                message = "This phone does not currently support strong biometric payment verification. Basic camera face unlock may unlock your screen but cannot authorize this payment. Use an enrolled fingerprint or supported strong face unlock.";
            }
            call.reject(message, "BIOMETRIC_UNAVAILABLE_" + available);
            return;
        }

        authenticationPending = true;
        try {
        BiometricPrompt prompt = new BiometricPrompt(activity, executor,
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                        authenticationPending = false;
                        lastStrongAuthenticationAt = System.currentTimeMillis();
                        JSObject response = new JSObject();
                        response.put("verified", true);
                        call.resolve(response);
                    }

                    @Override
                    public void onAuthenticationError(int code, CharSequence message) {
                        authenticationPending = false;
                        lastStrongAuthenticationAt = 0L;
                        call.reject(message == null ? "Owner verification failed." : message.toString());
                    }
                });

        String reason = call.getString("reason", "Confirm protected payment");
        BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                .setTitle("PayShield owner check")
                .setSubtitle(reason)
                .setAllowedAuthenticators(authenticators)
                .setNegativeButtonText("Cancel payment")
                .setConfirmationRequired(true)
                .build();
        prompt.authenticate(info);
        } catch (RuntimeException error) {
            authenticationPending = false;
            lastStrongAuthenticationAt = 0L;
            call.reject("Unable to open the Android identity check. Please try again.", error);
        }
    }

    @PluginMethod
    public void openUpi(PluginCall call) {
        String value = call.getString("uri");
        Integer riskScore = call.getInt("riskScore");
        if (value == null || !value.startsWith("upi://pay?")) {
            call.reject("Invalid UPI payment request.");
            return;
        }
        if (riskScore == null || riskScore > 90) {
            call.reject("PayShield blocked this payment because its risk score is above 90.");
            return;
        }
        if (System.currentTimeMillis() - lastStrongAuthenticationAt > 60_000L) {
            call.reject("A fresh fingerprint or face verification is required.");
            return;
        }
        lastStrongAuthenticationAt = 0L;
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(value));
        if (intent.resolveActivity(getContext().getPackageManager()) == null) {
            call.reject("No compatible UPI app is installed.");
            return;
        }
        getActivity().startActivity(Intent.createChooser(intent, "Complete payment with"));
        JSObject response = new JSObject();
        response.put("opened", true);
        call.resolve(response);
    }
}
