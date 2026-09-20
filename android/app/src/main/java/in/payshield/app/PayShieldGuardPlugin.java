package in.payshield.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.speech.RecognizerIntent;
import android.Manifest;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.SpeechRecognizer;
import android.speech.RecognitionListener;
import android.media.MediaPlayer;
import android.util.Base64;
import java.io.File;
import java.io.FileOutputStream;
import androidx.core.content.FileProvider;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

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

@CapacitorPlugin(name = "PayShieldGuard", permissions = { @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }) })
public class PayShieldGuardPlugin extends Plugin {
    private volatile long lastStrongAuthenticationAt = 0L;
    private boolean authenticationPending = false;
    private SpeechRecognizer recognizer;
    private PluginCall speechCall;
    private MediaPlayer player;
    private PluginCall audioCall;
    private File audioFile;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Runnable speechTimeout = () -> finishSpeech(null, "Listening timed out. Try again.");
    @PluginMethod
    public void listen(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) { requestPermissionForAlias("microphone", call, "microphonePermission"); return; }
        getActivity().runOnUiThread(() -> beginSpeech(call));
    }

    @PermissionCallback
    private void microphonePermission(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) { call.reject("Microphone permission is required for voice payments."); return; }
        getActivity().runOnUiThread(() -> beginSpeech(call));
    }
    private void finishSpeech(String transcript, String error) {
        mainHandler.removeCallbacks(speechTimeout);
        PluginCall pending = speechCall; speechCall = null;
        if (recognizer != null) { recognizer.destroy(); recognizer = null; }
        if (pending == null) return;
        if (error != null) pending.reject(error);
        else { JSObject out = new JSObject(); out.put("transcript", transcript); pending.resolve(out); }
    }
    private void beginSpeech(PluginCall call) {
        if (speechCall != null) { call.reject("A voice session is already listening."); return; }
        if (!SpeechRecognizer.isRecognitionAvailable(getContext())) { call.reject("No speech recognition service is available."); return; }
        speechCall = call;
        try {
            recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
            recognizer.setRecognitionListener(new RecognitionListener() {
                public void onReadyForSpeech(Bundle b) {} public void onBeginningOfSpeech() {} public void onRmsChanged(float r) {}
                public void onBufferReceived(byte[] b) {} public void onEndOfSpeech() {} public void onPartialResults(Bundle b) {} public void onEvent(int t, Bundle b) {}
                public void onError(int error) { finishSpeech(null, "Could not hear your response (" + error + "). Please try again."); }
                public void onResults(Bundle result) { ArrayList<String> values = result.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION); if (values == null || values.isEmpty()) finishSpeech(null, "No speech recognized."); else finishSpeech(values.get(0), null); }
            });
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-IN");
            recognizer.startListening(intent); mainHandler.postDelayed(speechTimeout, 20000);
        } catch (RuntimeException e) { finishSpeech(null, "Could not start voice recognition."); }
    }
    private void finishAudio(String error) {
        PluginCall pending = audioCall; audioCall = null;
        if (player != null) { player.release(); player = null; }
        if (audioFile != null) { audioFile.delete(); audioFile = null; }
        if (pending != null) { if (error == null) pending.resolve(); else pending.reject(error); }
    }
    @PluginMethod
    public void playAudio(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            finishAudio("Playback replaced."); audioCall = call;
            try {
                String data = call.getString("base64", ""); if (data.length() > 8000000) throw new Exception();
                audioFile = File.createTempFile("ps-voice-", ".mp3", getContext().getCacheDir());
                try (FileOutputStream out = new FileOutputStream(audioFile)) { out.write(Base64.decode(data, Base64.DEFAULT)); }
                player = new MediaPlayer(); player.setDataSource(audioFile.getAbsolutePath());
                player.setOnCompletionListener(p -> finishAudio(null));
                player.setOnErrorListener((p,w,e) -> { finishAudio("Audio playback failed."); return true; });
                player.setOnPreparedListener(MediaPlayer::start); player.prepareAsync();
            } catch (Exception e) { finishAudio("Unable to play voice guidance."); }
        });
    }
    @PluginMethod
    public void stopAudio(PluginCall call) { getActivity().runOnUiThread(() -> { finishAudio("Playback stopped."); call.resolve(); }); }
    @PluginMethod
    public void cancelListening(PluginCall call) { getActivity().runOnUiThread(() -> { finishSpeech(null, "Listening cancelled."); call.resolve(); }); }
    @PluginMethod
    public void shareReport(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                String id = call.getString("caseNumber", ""); if (!id.matches("PS-[A-F0-9]{16}")) throw new Exception();
                String data = call.getString("base64", ""); if (data.length() > 2000000) throw new Exception();
                File report = new File(getContext().getCacheDir(), id + ".pdf");
                try (FileOutputStream out = new FileOutputStream(report)) { out.write(Base64.decode(data, Base64.DEFAULT)); }
                Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", report);
                Intent intent = new Intent(Intent.ACTION_SEND).setType("application/pdf").putExtra(Intent.EXTRA_STREAM, uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                getActivity().startActivity(Intent.createChooser(intent, "Save or share sender report")); call.resolve();
            } catch (Exception e) { call.reject("Could not share the PDF. Retry from your case receipt."); }
        });
    }
    @Override protected void handleOnDestroy() { mainHandler.post(() -> { finishSpeech(null, "Session closed."); finishAudio("Session closed."); }); }

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
