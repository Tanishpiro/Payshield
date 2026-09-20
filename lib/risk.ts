// PayShield Risk Engine — explainable, rule + behaviour + reputation + network scoring.

export type Reason = {
  code: string;
  label: string;
  detail: string;
  weight: number;
  category: "identity" | "age" | "velocity" | "behaviour" | "reputation" | "device" | "network";
  direction: "risk" | "trust";
};

export type RiskLevel = "low" | "medium" | "high" | "critical";
export type Action = "allow" | "warn" | "verify" | "block";

export type ReceiverFacts = {
  handle: string;
  display_name: string;
  category: string | null;
  city: string | null;
  bank_name: string | null;
  account_created_at: string;
  kyc_status: "verified" | "partial" | "unverified" | string;
  avg_ticket: number;
  totalTx: number;
  tx24h: number;
  tx7d: number;
  uniqueSenders24h: number;
  distinctDays: number;
  signals: { signal_type: string; severity: number; confirmed: boolean; detail: string | null; reported_at: string }[];
  devices: { fingerprint: string; is_emulator: boolean; is_vpn: boolean; ip_country: string; sharedWith: number }[];
  links: { handle: string; link_type: string; strength: number; flagged: boolean }[];
};

export type Assessment = {
  score: number;
  level: RiskLevel;
  action: Action;
  headline: string;
  reasons: Reason[];
  positives: Reason[];
  trustScore: number;
  amount: number;
  confidence: number;
  policyVersion: string;
};

const DAY = 86400000;

export function accountAgeDays(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / DAY));
}

export function levelFor(score: number): RiskLevel {
  if (score <= 30) return "low";
  if (score <= 70) return "medium";
  if (score <= 90) return "high";
  return "critical";
}

export function actionFor(level: RiskLevel): Action {
  return level === "low" ? "allow" : level === "medium" ? "warn" : level === "high" ? "verify" : "block";
}

export const LEVEL_META: Record<RiskLevel, { label: string; dot: string; text: string; bg: string; border: string; action: string }> = {
  low: { label: "Low Risk", dot: "bg-emerald-400", text: "text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-500/30", action: "Payment can proceed" },
  medium: { label: "Medium Risk", dot: "bg-amber-400", text: "text-amber-300", bg: "bg-amber-500/10", border: "border-amber-500/30", action: "Confirm before paying" },
  high: { label: "High Risk", dot: "bg-orange-400", text: "text-orange-300", bg: "bg-orange-500/10", border: "border-orange-500/30", action: "Additional verification required" },
  critical: { label: "Critical Risk", dot: "bg-rose-500", text: "text-rose-300", bg: "bg-rose-500/10", border: "border-rose-500/30", action: "Payment blocked for review" },
};

/** Trust score (0-100) — dynamic receiver reputation, not a blacklist. */
export function trustScore(f: ReceiverFacts): number {
  const age = accountAgeDays(f.account_created_at);
  let t = 20;
  t += f.kyc_status === "verified" ? 30 : f.kyc_status === "partial" ? 12 : 0;
  t += Math.min(20, Math.round(Math.log10(age + 1) * 10)); // maturity
  t += Math.min(15, Math.round(Math.log10(f.totalTx + 1) * 7)); // legitimate history
  t += Math.min(10, Math.round(f.distinctDays / 20)); // consistency over time
  t += f.category === "merchant" ? 5 : 0;
  const sigPenalty = f.signals.reduce((s, x) => s + x.severity * (x.confirmed ? 5 : 2.5), 0);
  t -= sigPenalty;
  t -= f.links.filter((l) => l.flagged).length * 4;
  t -= f.devices.some((d) => d.is_emulator || d.is_vpn) ? 8 : 0;
  return Math.max(0, Math.min(100, Math.round(t)));
}

export function assess(f: ReceiverFacts, amount: number): Assessment {
  const reasons: Reason[] = [];
  const positives: Reason[] = [];
  const age = accountAgeDays(f.account_created_at);
  const add = (r: Reason) => (r.direction === "risk" ? reasons : positives).push(r);

  // 1. Account age
  if (age < 7) add({ code: "AGE_VERY_NEW", label: "Receiver account is newly created", detail: `Account is only ${age} day${age === 1 ? "" : "s"} old`, weight: 22, category: "age", direction: "risk" });
  else if (age < 30) add({ code: "AGE_NEW", label: "Recently created receiver account", detail: `Account is ${age} days old`, weight: 14, category: "age", direction: "risk" });
  else if (age < 180) add({ code: "AGE_YOUNG", label: "Relatively young account", detail: `Account is ${Math.round(age / 30)} months old`, weight: 5, category: "age", direction: "risk" });
  else add({ code: "AGE_MATURE", label: "Established account history", detail: `Active for ${Math.round(age / 365 * 10) / 10} years`, weight: 12, category: "age", direction: "trust" });

  // 2. Identity / KYC
  if (f.kyc_status === "unverified") add({ code: "KYC_NONE", label: "Identity verification is incomplete", detail: "No KYC completed for this receiver", weight: 20, category: "identity", direction: "risk" });
  else if (f.kyc_status === "partial") add({ code: "KYC_PARTIAL", label: "Partial identity verification", detail: "KYC started but not fully verified", weight: 10, category: "identity", direction: "risk" });
  else add({ code: "KYC_OK", label: "Identity verified", detail: `KYC verified · ${f.bank_name ?? "bank account"} matched`, weight: 15, category: "identity", direction: "trust" });

  // 3. Velocity
  if (f.tx24h >= 150) add({ code: "VEL_EXTREME", label: "Unusual number of transactions detected", detail: `${f.tx24h} incoming payments in the last 24 hours`, weight: 17, category: "velocity", direction: "risk" });
  else if (f.tx24h >= 60) add({ code: "VEL_HIGH", label: "High incoming transaction velocity", detail: `${f.tx24h} incoming payments in the last 24 hours`, weight: 12, category: "velocity", direction: "risk" });
  const priorDailyRate = Math.max(1, (f.tx7d - f.tx24h) / 6);
  if (f.tx24h >= 20 && f.tx24h > priorDailyRate * 4) add({ code: "VEL_SPIKE", label: "Sudden transaction activity spike", detail: `Today's activity is ${Math.round(f.tx24h / priorDailyRate)}× the recent daily baseline`, weight: 10, category: "velocity", direction: "risk" });
  if (f.uniqueSenders24h >= 50 && age < 60) add({ code: "VEL_SENDERS", label: "Money collected from many unrelated senders", detail: `${f.uniqueSenders24h} distinct senders in 24h on a ${age}-day-old account`, weight: 12, category: "velocity", direction: "risk" });
  if (f.totalTx > 300 && f.distinctDays > 120 && f.tx24h < 60) add({ code: "VEL_STEADY", label: "Consistent, organic transaction pattern", detail: `${f.totalTx} payments spread across ${f.distinctDays} days`, weight: 10, category: "velocity", direction: "trust" });

  // 4. Behavioural anomaly — amount vs the receiver's normal ticket
  const avg = f.avg_ticket || 0;
  if (avg > 0 && amount > avg * 6 && amount >= 5000) add({ code: "BEH_AMOUNT", label: "Amount is far above this receiver's normal", detail: `₹${amount.toLocaleString("en-IN")} vs a typical ₹${Math.round(avg).toLocaleString("en-IN")}`, weight: 10, category: "behaviour", direction: "risk" });
  if (age < 30 && amount >= 10000) add({ code: "BEH_HIGH_NEW", label: "Large payment to a new receiver", detail: `₹${amount.toLocaleString("en-IN")} to an account opened ${age} days ago`, weight: 8, category: "behaviour", direction: "risk" });

  // 5. Reputation — fraud signals
  const confirmed = f.signals.filter((s) => s.confirmed);
  const reports = f.signals.filter((s) => !s.confirmed);
  if (confirmed.length) {
    const sev = confirmed.reduce((a, b) => a + b.severity, 0);
    add({ code: "SIG_CONFIRMED", label: "Previous fraud signals associated with the receiver", detail: `${confirmed.length} confirmed signal${confirmed.length > 1 ? "s" : ""} · ${confirmed.map((c) => c.signal_type.replace(/_/g, " ")).join(", ")}`, weight: Math.min(27, 8 + sev * 2.2), category: "reputation", direction: "risk" });
  }
  if (reports.length) add({ code: "SIG_REPORTS", label: "Unconfirmed user complaints on record", detail: `${reports.length} pending report${reports.length > 1 ? "s" : ""} from senders`, weight: Math.min(14, reports.length * 5), category: "reputation", direction: "risk" });
  if (!f.signals.length && f.totalTx > 100) add({ code: "SIG_CLEAN", label: "No fraud signals on record", detail: `Clean across ${f.totalTx} historical payments`, weight: 10, category: "reputation", direction: "trust" });

  // 6. Device & network risk
  const bad = f.devices.filter((d) => d.is_emulator || d.is_vpn || d.ip_country !== "IN");
  if (bad.length) {
    const bits = [
      bad.some((d) => d.is_emulator) ? "rooted emulator" : null,
      bad.some((d) => d.is_vpn) ? "VPN/proxy exit" : null,
      bad.find((d) => d.ip_country !== "IN") ? `foreign IP (${bad.find((d) => d.ip_country !== "IN")!.ip_country})` : null,
    ].filter(Boolean);
    add({ code: "DEV_RISK", label: "Risky device or network signals", detail: `Receiver seen on ${bits.join(", ")}`, weight: 14, category: "device", direction: "risk" });
  }
  const shared = f.devices.filter((d) => d.sharedWith > 1);
  if (shared.length) add({ code: "DEV_SHARED", label: "Device shared across multiple receiver accounts", detail: `${shared[0].fingerprint} is used by ${shared[0].sharedWith} receiver accounts`, weight: 12, category: "device", direction: "risk" });

  // 7. Fraud-network analysis
  const flagged = f.links.filter((l) => l.flagged);
  const strongestLink = flagged.reduce((max, link) => Math.max(max, link.strength || 0), 0);
  if (flagged.length >= 2) add({ code: "NET_CLUSTER", label: "Connected to a suspected fraud network", detail: `Linked to ${flagged.length} flagged accounts (${flagged.slice(0, 3).map((l) => l.handle).join(", ")})`, weight: 17 + Math.round(strongestLink * 3), category: "network", direction: "risk" });
  else if (flagged.length === 1) add({ code: "NET_LINK", label: "Connection with a previously flagged entity", detail: `${flagged[0].link_type.replace(/_/g, " ")} link to ${flagged[0].handle}`, weight: 10 + Math.round(strongestLink * 4), category: "network", direction: "risk" });

  const riskRaw = reasons.reduce((a, r) => a + r.weight, 0);
  const trustRaw = positives.reduce((a, r) => a + r.weight, 0);
  // Trust offsets risk but can never fully erase a confirmed fraud signal.
  const amountAnomaly = reasons.some((r) => r.code === "BEH_AMOUNT");
  const coordinatedConfirmedFraud = confirmed.length > 0 && flagged.length >= 2 && bad.length > 0;
  const floor = coordinatedConfirmedFraud ? 91 : confirmed.length ? 72 : amountAnomaly ? 31 : 0;
  const net = riskRaw - trustRaw * 0.45 + (riskRaw > 0 ? 6 : 0);
  // Diminishing returns above 90 so stacked signals stay separable instead of all pinning at 100.
  const compressed = net <= 90 ? net : 90 + (net - 90) * (10 / 70);
  const score = Math.max(floor, Math.min(100, Math.round(compressed)));
  const level = levelFor(Math.max(0, score));
  const action = actionFor(level);

  const top = [...reasons].sort((a, b) => b.weight - a.weight)[0];
  const headline =
    level === "low"
      ? "This receiver looks safe to pay."
      : level === "medium"
      ? `Proceed carefully — ${top?.label.toLowerCase() ?? "some signals need attention"}.`
      : level === "high"
      ? `Verify before paying — ${top?.label.toLowerCase() ?? "multiple risk signals"}.`
      : `Payment blocked — ${top?.label.toLowerCase() ?? "critical fraud signals detected"}.`;

  return {
    score: Math.max(0, score),
    level,
    action,
    headline,
    reasons: reasons.sort((a, b) => b.weight - a.weight),
    positives: positives.sort((a, b) => b.weight - a.weight),
    trustScore: trustScore(f),
    amount,
    confidence: Math.min(99, Math.round(58 + Math.log10(f.totalTx + 1) * 12 + Math.min(12, f.distinctDays / 30))),
    policyVersion: "AI-POLICE-2.0",
  };
}
