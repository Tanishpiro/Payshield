# PayShield 2.4 prototype

Investigator website: https://payshield-ai-police.netlify.app/investigator

Demo username: `cyber.demo`

Demo password: `PayShieldDemo!24`

These shared credentials are only for fictional training records, never real KYC records. Authentication uses a server-signed, one-hour HttpOnly cookie. Direct case lookup without a valid session returns 401. Records persist in a private site-wide Netlify Blobs store across deployments.

## Sender reporting

Run a payment check or finish a simulated payment. Choose the report category and create a scam report. The server issues a random case number and a sender PDF, which Android can save/share with its system share sheet. Keep the PDF/case number before leaving the payment. There is no report history/account system yet.

The sender response and PDF contain only an assessment snapshot, selected reason labels and the demo VPN indicator. Unknown VPN state stays unknown. Private fields are never included in the sender response. A report is an allegation and does not automatically alter receiver scores or file an official police complaint.

The investigator signs in on the website and searches the PDF case number. A separate, explicitly fictional fixture contains documentation-only IP, dummy MAC, masked dummy phone, simulated VPN/location and fictional KYC fields. These fields are not derived from the real receiver. A UPI identifier cannot disclose a remote MAC or KYC address.

## Voice payments

Open Voice settings once and enter PAYSHIELD_VOICE_ACCESS_TOKEN from `.env.local`. The deployed backend URL is preconfigured. Tap Voice pay, allow microphone access and say “Send 2000 rupees from HDFC to Suresh.”

An in-place voice panel replaces the details/result navigation. Android SpeechRecognizer listens without the separate Google recognition activity. The score is spoken by native Android audio playback, independent of WebView scrolling/autoplay. The number/QR demo profiles are calculated immediately; ElevenLabs still needs an internet request before speech starts.

After narration, say “approve” or “cancel”. Negative/ambiguous responses never authorize payment. Android strong biometric authentication is mandatory. This build only simulates success and never opens a UPI app. It does not select a real debit account or transfer money. Scores above 90 remain blocked. Speech recognition is not speaker identity verification.

Hardware microphone, fingerprint and face checks require testing on an Android device. Basic face unlock may not qualify as Android strong biometrics.

## Maintenance

`node scripts/test-cases.mjs` checks report redaction, sessions, login and PDF generation. `scripts/deploy-backend.ps1` deploys a clean functions-only stage, preventing stale Next.js handlers from being published. Keep server credentials in Netlify environment variables. Local API limits are per function instance for this prototype.
