# Local ElevenLabs testing

The backend keeps the ElevenLabs API key in ignored `.env.local`. Never place it in the APK or a NEXT_PUBLIC variable. Rotate the key shared in chat before broader use. Sarah is the initial voice; set ELEVENLABS_VOICE_ID to change it.

## Start

Run `powershell -ExecutionPolicy Bypass -File scripts/start-voice-local.ps1` from this project. Visit http://localhost:3010/pay for browser testing. Leave the backend URL blank in browser Voice settings.

For Android, install PayShield-latest.apk (2.2), enable USB debugging, connect your phone and accept its USB authorization prompt. The script forwards port 3010. If you connect later, run:

```powershell
& 'C:\Android\android-sdk\platform-tools\adb.exe' reverse tcp:3010 tcp:3010
```

Open Voice settings in PayShield. Set backend URL to `http://localhost:3010`. Copy the value of PAYSHIELD_VOICE_ACCESS_TOKEN from `.env.local` into Private voice access code. This is NOT the ElevenLabs key. Tap Test voice, then enable Read payment guidance aloud. Keep the PC server and USB connection running. Internet access on the PC is required for ElevenLabs.

The debug build permits HTTP only to localhost/127.0.0.1; release deployment needs HTTPS. Native HTTP handles the Android connection. The access code is session-only and may need entering again after restarting the app.

## Behavior and limits

- Reads risk results and demo/handoff status; does not authenticate a speaker, authorize a payment, or confirm a bank transfer.
- Stops playback when leaving results or opening microphone/biometric steps.
- Scores above 90 always narrate a block. Fixed numeric/QR prototype scores are identified as demo scores, not fraud probabilities.
- Replay uses the currently cached audio without spending more credits.
- Amount, receiver display name and templated risk summary are sent to ElevenLabs when speech is requested. Do not use sensitive real customer data in this prototype.
- Backend validates requests, hides provider errors and limits generation to 12 requests/minute per process. The shared access code and process-local limit are for private local testing, not production authentication or distributed rate limiting.
- Set a restricted ElevenLabs key and credit limit. No payment app can guarantee 100% scam prevention.

See [ElevenLabs text-to-speech API](https://elevenlabs.io/docs/api-reference/text-to-speech/convert).
