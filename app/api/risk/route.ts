import { NextResponse } from "next/server";
import { loadAll, buildFacts, sb } from "@/lib/data";
import { applyPrototypeProfile, assess } from "@/lib/risk";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const handle = String(body.handle ?? "").trim().toLowerCase();
  const amount = Number(body.amount ?? 0);
  const sender = String(body.sender ?? "you@payshield");
  const isNumber = /^\+?\d{10,15}$/.test(handle);
  if (!isNumber && !/^[\w.-]+@[\w.-]+$/.test(handle)) return NextResponse.json({ error: "Enter a valid UPI ID or 10–15 digit payment number" }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0 || amount > 200000)
    return NextResponse.json({ error: "Amount must be between ₹1 and ₹2,00,000" }, { status: 400 });

  const all = await loadAll();
  const { facts } = buildFacts(all);
  const entry = [...facts.entries()].find(([, f]) => f.handle.toLowerCase() === handle);

  if (!entry) {
    if (body.inputMode === "qr") {
      const assessment = applyPrototypeProfile({
        score: 78, level: "high", action: "verify", trustScore: 10, amount,
        headline: "Unknown receiver", reasons: [], positives: [], confidence: 100,
        policyVersion: "AI-POLICE-2.0", scoreBasis: "risk-engine",
      }, "qr");
      return NextResponse.json({ found: true, receiver: { handle, display_name: "Scanned demo receiver", kyc_status: "unverified", links: [] }, assessment });
    }
    if (isNumber) {
      const assessment = applyPrototypeProfile({
        score: 78, level: "high", action: "verify", trustScore: 10, amount,
        headline: "Unknown receiver", reasons: [], positives: [], confidence: 100,
        policyVersion: "AI-POLICE-2.0", scoreBasis: "risk-engine",
      }, "number");
      return NextResponse.json({ found: true, receiver: { handle, display_name: `Demo receiver ${handle.slice(-4)}`, kyc_status: "verified", links: [] }, assessment });
    }
    // Unknown receiver — treated as high risk, not blocked outright.
    return NextResponse.json({
      found: false,
      receiver: { handle, display_name: "Unknown receiver", kyc_status: "unverified" },
      assessment: {
        score: 78, level: "high", action: "verify", trustScore: 10, amount,
        headline: "Verify before paying — receiver is not recognised by any PayShield partner.",
        reasons: [
          { code: "UNKNOWN", label: "Receiver not found in PayShield intelligence", detail: "No identity, history or reputation available for this payment identifier", weight: 40, category: "identity", direction: "risk" },
          { code: "NO_HISTORY", label: "No transaction history available", detail: "Nothing to establish legitimate behaviour", weight: 20, category: "behaviour", direction: "risk" },
        ],
        positives: [],
      },
    });
  }

  const [id, storedFacts] = entry;
  const simulatedKyc = body.simulateKyc;
  const demoMode = process.env.PAYSHIELD_DEMO_MODE === "true" || process.env.NODE_ENV === "development";
  const f = demoMode && ["verified", "partial", "unverified"].includes(simulatedKyc)
    ? { ...storedFacts, kyc_status: simulatedKyc }
    : storedFacts;
  const requestedProfile = body.inputMode === "qr" ? "qr" : isNumber ? "number" : undefined;
  const a = applyPrototypeProfile(assess(f, amount), requestedProfile);
  const r = all.receivers.find((x) => x.id === id)!;

  const { error: insertError } = await sb().from("ps_assessments").insert({
    receiver_id: id, receiver_handle: f.handle, sender_handle: sender, amount,
    score: a.score, level: a.level, action: a.action, trust_score: a.trustScore,
    reasons: a.reasons.map((x) => ({ code: x.code, label: x.label, detail: x.detail, weight: x.weight })),
  });
  if (insertError) console.error("assessment audit write failed", insertError.message);

  return NextResponse.json({
    found: true,
    receiver: {
      handle: f.handle, display_name: f.display_name, city: f.city, category: f.category,
      bank_name: f.bank_name, kyc_status: f.kyc_status, account_created_at: f.account_created_at,
      totalTx: f.totalTx, tx24h: f.tx24h, signals: f.signals.length,
      links: f.links.map((l) => ({ handle: l.handle, link_type: l.link_type, flagged: l.flagged })),
    },
    assessment: a,
    simulated: f.kyc_status !== storedFacts.kyc_status,
    _id: r.id,
  });
}
