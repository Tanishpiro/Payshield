# PayShield — local setup

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

Android Studio ya Android SDK + JDK 21 chahiye. `local.properties` me `sdk.dir=<your SDK path>`.

## 3. Supabase

Project: **gimi-ai** (`mrkehxmoqpxaycrtcxwq`), tables `ps_` prefix ke saath —
`ps_receivers`, `ps_devices`, `ps_receiver_devices`, `ps_transactions`,
`ps_fraud_signals`, `ps_receiver_links`, `ps_assessments`.
RLS on, read public, assessments insert public.

Naya free project nahi ban paya (free limit 2 active projects — `order-automation-erp`
aur `gimi-ai` already active hain). Ek pause karoge to PayShield ka apna project bana dunga.

## 4. Demo flow (jo judges ko dikhana hai)

Live Check tab → receiver chuno → amount → Analyse.

| Receiver | Score | Level | Decision |
|---|---|---|---|
| sharma.kirana@okaxis | 4 | Low | Allow |
| newstore2026@ybl | 44 | Medium | Warn |
| instant.loan.help@ybl | 84 | High | Verify |
| rewards.refund@okicici | 93 | Critical | Block |
| lucky.draw.winner@upi | 94 | Critical | Block |
| quickcash.offers@okhdfcbank | 98 | Critical | Block |

**Dynamic trust demo:** `newstore2026@ybl` pe "verified" button dabao →
score 44 → **27 (Low)**, trust 65 → **83**. Blacklist nahi, reputation system.

**Fraud network:** quickcash / lucky.draw / rewards.refund / instant.loan ek cluster hain
(shared emulator device + onward transfers). Graph tab me hover karke dikha sakte ho.

## Risk engine

`lib/risk.ts` — 7 categories, har reason ka weight aur plain-English explanation:
identity/KYC, account age, velocity, behavioural anomaly, reputation (fraud signals),
device/network, fraud-graph links. Trust signals risk ko offset karte hain, par ek
confirmed fraud complaint ke baad score 72 se neeche nahi ja sakta.
