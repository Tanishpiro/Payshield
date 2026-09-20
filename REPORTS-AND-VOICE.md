# PayShield 2.4 prototype

Investigator website: https://payshield-ai-police.netlify.app/investigator

Demo username: `cyber.demo`

Demo password: `PayShieldDemo!24`

These shared credentials are only for fictional training records, never real KYC records. Authentication uses a server-signed, one-hour HttpOnly cookie. Direct case lookup without a valid session returns 401. Records persist in a private site-wide Netlify Blobs store across deployments.

## Sender reporting

Finish a simulated payment. The success page alone shows the scam-report option. Choose a category and create the report. The server issues a random case number and a sender PDF, which Android can save/share. Keep the PDF/case number before leaving; there is no sender account/history system yet.

The sender response and PDF contain only an assessment snapshot, selected reason labels and the demo VPN indicator. Unknown VPN state stays unknown. Private fields are never included in the sender response. A report is an allegation and does not automatically alter receiver scores or file an official police complaint.

The investigator signs in on the website and searches the PDF case number. A separate, explicitly fictional fixture contains documentation-only IP, dummy MAC, masked dummy phone, simulated VPN/location and fictional KYC fields. These fields are not derived from the real receiver. A UPI identifier cannot disclose a remote MAC or KYC address.

## Voice payments

Open Voice settings once and enter PAYSHIELD_VOICE_ACCESS_TOKEN from `.env.local`. The deployed backend URL is preconfigured. Tap Voice pay, allow microphone access and say “Send 2000 rupees from HDFC to Suresh.”

An in-place voice panel replaces the details/result navigation. Android SpeechRecognizer listens without the separate Google recognition activity. The score is spoken by native Android audio playback, independent of WebView scrolling/autoplay. The number/QR demo profiles are calculated immediately; ElevenLabs still needs an internet request before speech starts.

After narration, say “approve” or “cancel”. Negative/ambiguous responses never authorize payment. Android strong biometric authentication is mandatory. This build only simulates success and never opens a UPI app. It does not select a real debit account or transfer money. Scores above 90 remain blocked. Speech recognition is not speaker identity verification.

Hardware microphone, fingerprint and face checks require testing on an Android device. Basic face unlock may not qualify as Android strong biometrics.

## Maintenance

### Android v2.7 additions

### v2.8 case submission and shared updates

Create scam report now opens a confirmation step with a Submit case action. Submitted demo cases enter the authenticated investigator New cases inbox, which refreshes every 30 seconds while visible or on manual refresh. Once an investigation note or decision is recorded, the case is no longer New; existing case-number lookup still opens its full history. The demo inbox is bounded to 500 reports and explicitly errors above that limit rather than silently omitting cases.

Investigators can opt a new note into sender visibility using the checkbox next to the note form. Only these deliberately shared note texts appear in Track case; old/private notes still return generic activity labels. Shared notes are visible to anyone holding the case reference, so investigators must not include private evidence. The underlying dossier and investigator identity are never exposed by progress lookup. This extends the v2.7 fixed-label-only response with an optional `note` field on shared timeline events.

Home now includes a collapsible Track case card. The public POST `action=progress` endpoint accepts a full random case number and returns only fixed status labels, dates, generic activity and a fixed closure outcome. It never returns investigator text, actor identity, receiver ID, transaction amount or the private dossier. Anyone holding the case reference can read this limited synthetic status; keep case numbers private. This is not authenticated sender access for a production service.

Voice settings include Save voice code on this phone. Android encrypts the backend access token using an Android Keystore AES-GCM key and stores only ciphertext/IV in app-private preferences. It loads on app restart; clearing and saving removes it. Provider API keys remain server-side. Reinstalling or clearing app data may require setup again. Browser storage remains session-only. Device testing is still required to validate persistence on a physical phone.

## Investigator workflow (v2.5)

The website supports timestamped notes, full case timeline, JSON history export, closure with rationale, and reopening without erasing past decisions. Outcomes: sender report substantiated / receiver fraud, receiver cleared in this case, or inconclusive. Login uses a shared demo account, not individually attributable investigator identities. All findings concern synthetic data only.

New reports include the receiver identifier. Closing a linked case as receiver fraud caps trust at 10/100 and sets a risk floor of 95/100. Pending, cleared or inconclusive cases add no penalty. Reopening removes only that case's penalty; other active confirmed cases still apply. Legacy reports without a receiver link cannot change scores. Concurrent edits require the current case version and storage ETag; stale writes return 409.

App checks the backend receiver policy during risk assessment and before/after biometric verification. If unavailable, it does not approve payment. Fixed number/QR demo scores cannot override a confirmed finding. This is prototype client enforcement, not bank-grade transaction authorization. There is no guarantee of scam-free payments.

Voice approval narration is shortened to the score and approve/cancel instruction. Approval still requires strong biometrics. Successful simulation displays the success screen, with the sender report form underneath.

Tests: `node scripts/test-workflow.mjs`, `node scripts/test-case-workspace.cjs` (live synthetic case), `node scripts/test-payment-flow.cjs` (mock hardware), `node scripts/test-voice.cjs`.

`node scripts/test-cases.mjs` checks report redaction, sessions, login and PDF generation. `scripts/deploy-backend.ps1` deploys a clean functions-only stage, preventing stale Next.js handlers from being published. Keep server credentials in Netlify environment variables. Local API limits are per function instance for this prototype.
