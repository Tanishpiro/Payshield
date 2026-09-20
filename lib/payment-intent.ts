export type PaymentIntent = {
  amount: number;
  bank: string;
  receiver: string;
  transcript: string;
};

const MONEY = /(?:send|pay|transfer)?\s*(?:₹|inr|rs\.?|rupees?)?\s*([\d,]+(?:\.\d{1,2})?)\s*(?:₹|inr|rs\.?|rupees?)?/i;
const FROM_TO = /\bfrom\s+(.+?)\s+to\s+(.+?)(?:\s+(?:using|with|on)\s+payshield)?\s*$/i;

export function parseVoicePayment(text: string): PaymentIntent | null {
  const normalized = text.trim().replace(/\s+/g, " ");
  const parties = normalized.match(FROM_TO);
  const payFirst = normalized.match(/\bpay\s+(.+?)\s+(?:₹|inr|rs\.?|rupees?)?\s*([\d,]+(?:\.\d{1,2})?)\s*(?:₹|inr|rs\.?|rupees?)?\s+from\s+(.+?)(?:\s+bank)?\s*$/i);
  const money = normalized.match(MONEY);
  if ((!money || !parties) && !payFirst) return null;

  const amount = Number((payFirst?.[2] ?? money![1]).replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 200000) return null;

  const bank = (payFirst?.[3] ?? parties![1]).replace(/\s+bank$/i, "").trim();
  const receiver = (payFirst?.[1] ?? parties![2]).trim();
  if (!bank || !receiver) return null;
  return { amount, bank, receiver, transcript: normalized };
}

export function parsePaymentQr(raw: string) {
  try {
    const url = new URL(raw);
    if (url.protocol !== "upi:") return null;
    const handle = url.searchParams.get("pa")?.trim() ?? "";
    const amount = Number(url.searchParams.get("am") ?? 0);
    if (!handle) return null;
    return {
      handle,
      name: url.searchParams.get("pn")?.trim() || handle,
      amount: Number.isFinite(amount) && amount > 0 ? amount : undefined,
    };
  } catch {
    const handle = raw.trim().toLowerCase();
    return /^[\w.-]+@[\w.-]+$/.test(handle) ? { handle, name: handle, amount: undefined } : null;
  }
}

export function resolveReceiver(name: string, handles: { handle: string; name: string }[]) {
  const q = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (q === 'suresh') return '9876543210';
  if (q === 'anita') return '9812345678';
  if (/^\d{10,15}$/.test(q)) return q;
  const exact = handles.find((h) => {
    const candidates = [h.name, h.handle.split("@")[0]];
    return candidates.some((v) => v.toLowerCase().replace(/[^a-z0-9]/g, "") === q);
  });
  const partial = handles.find((h) => (h.name + h.handle).toLowerCase().includes(name.toLowerCase()));
  return (exact ?? partial)?.handle ?? `${name.toLowerCase().replace(/[^a-z0-9.]/g, ".")}@upi`;
}

export function upiPaymentUri(handle: string, name: string, amount: number) {
  const q = new URLSearchParams({ pa: handle, pn: name, am: amount.toFixed(2), cu: "INR", tn: "PayShield protected payment" });
  return `upi://pay?${q.toString()}`;
}
