# PayShield 2.0 — protected payments before money moves

PayShield is a hackathon-grade, explainable pre-payment risk layer. Version 2 adds real QR camera scanning, Google Assistant App Action declarations, voice payment parsing, strong Android biometric confirmation, native UPI handoff, and a hardened AI Police 2.0 policy.

## Safety contract

- A score of **91–100 is always blocked**. The web UI and native Android bridge both enforce this rule.
- Every Android payment handoff requires a fresh **strong fingerprint or face check**.
- Voice payments use two steps: a recognized payment instruction plus strong biometric owner confirmation.
- Android speech recognition understands the instruction; it is not treated as speaker identity proof.
- PayShield never silently transfers funds. After risk and identity checks it opens an installed UPI app, where the regulated provider performs final authorization.
- No fraud product can promise zero fraud. This prototype fails closed on critical risk and is designed to reduce fraud with explainable controls.

## Prototype dummy profiles

- A manually entered 10–15 digit payment number receives a fixed **10/100 Low Risk** score.
- A receiver obtained from a scanned UPI QR receives a fixed **80/100 High Risk** score.
- These results are labelled synthetic and never open a real UPI payment app or move funds.
- Manually entered UPI IDs and voice-resolved UPI IDs continue through the normal AI Police engine.

## Risk factors

Normal AI Police scores measure seven groups of signals:

1. Identity and KYC completion.
2. Receiver account age and maturity.
3. Transaction velocity, unique senders, and sudden activity spikes.
4. Payment amount compared with the receiver's normal ticket size.
5. Confirmed fraud signals, unresolved complaints, and clean history.
6. Emulator, VPN, foreign-IP, and shared-device indicators.
7. Links to flagged receivers and suspected fraud-network clusters.

Trust signals—verified identity, established history, consistent activity, and a clean reputation—offset risk. Confirmed or coordinated fraud applies hard minimum scores so trust cannot erase serious evidence.

Deployment kuch nahi kiya. Sab local hai, aur Supabase pe data already ready hai.

## 1. Web dashboard + pay app (PC)

```bash
unzip payshield.zip -d PayShield
cd PayShield
npm install
npm run dev
```

- `http://localhost:3000` → PC dashboard (Overview, Live Check, Receivers, Fraud Network, Transactions)
- `http://localhost:3000/pay` → mobile pay flow (browser me phone size pe dekho)

`.env.local` zip me hai — Supabase URL + publishable key already set.

## 2. Android app

Web bundle `android-www/` me build hota hai aur app Supabase se seedha baat karta hai
(risk engine on-device chalta hai, server ki zarurat nahi).

```bash
# bundle banao
npx esbuild mobile/main.tsx --bundle --minify --format=iife --jsx=automatic \
  --define:process.env.NODE_ENV='"production"' --outfile=android-www/app.js
cp mobile/index.html public/icon.svg android-www/
npx @tailwindcss/cli -i mobile/app.css -o android-www/app.css --minify

# android project
npx cap add android
npx cap sync android
cd android && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

The ready-to-install build is also copied to `PayShield-latest.apk`.

### Camera and voice

- Tap the QR frame to scan a real UPI QR using the rear camera. Frames are decoded on-device and are not uploaded.
- Tap **Speak a payment** and say: `Send 2000 rupees from HDFC Bank to Suresh`.
- For Google Assistant/App Actions, use: `Hey Google, open PayShield and send 2000 rupees from HDFC to Suresh`.
- Assistant custom intents require an English (US) Assistant locale, a Play Console test/release build, an App Actions preview, and Google review before public discovery.
- The named bank is carried into the review screen. The final UPI provider controls which linked account is used; PayShield cannot select or debit an HDFC account without authorized PSP/bank integration.

Android Studio ya Android SDK + JDK 21 chahiye. `local.properties` me `sdk.dir=<your SDK path>`.

## 3. Supabase

Project: **gimi-ai** (`mrkehxmoqpxaycrtcxwq`), tables `ps_` prefix ke saath —
`ps_receivers`, `ps_devices`, `ps_receiver_devices`, `ps_transactions`,
`ps_fraud_signals`, `ps_receiver_links`, `ps_assessments`.
RLS on, read public, assessments insert public.

Naya free project nahi ban paya (free limit 2 active projects — `order-automation-erp`
aur `gimi-ai` already active hain). Ek pause karoge to PayShield ka apna project bana dunga.

## 4. Demo flow

Live Check tab → receiver chuno → amount → Analyse.

Scores are calculated from live synthetic data and can move as account age, velocity, KYC, complaints, devices, and graph connections change. Do not script fixed numeric values. Demonstrate one low-risk receiver, one high-risk receiver, and one score above 90 to show the hard block.

**Dynamic trust demo:** change `newstore2026@ybl` between unverified, partial, and verified. This is now a non-persistent simulation and cannot modify the shared KYC database.

**Fraud network:** quickcash / lucky.draw / rewards.refund / instant.loan ek cluster hain
(shared emulator device + onward transfers). Graph tab me hover karke dikha sakte ho.

## Risk engine

`lib/risk.ts` — 7 categories, weighted links, velocity-spike detection, amount-anomaly policy floors, coordinated-fraud hard floors, confidence, and plain-English explanations:
identity/KYC, account age, velocity, behavioural anomaly, reputation (fraud signals),
device/network, fraud-graph links. Trust signals risk ko offset karte hain, par ek
confirmed fraud complaint ke baad score 72 se neeche nahi ja sakta.
