import { timingSafeEqual } from "node:crypto";

const allowedReasons = {
  AGE_VERY_NEW: "The receiver account is newly created.", KYC_NONE: "The receiver has not completed identity verification.",
  VEL_EXTREME: "The receiver has unusually high incoming payment activity.", SIG_CONFIRMED: "Confirmed fraud signals are associated with the receiver.",
  SIG_REPORTS: "There are complaints about the receiver.", DEV_RISK: "Device or network risk signals were detected.",
  NET_CLUSTER: "The receiver is connected to a suspected fraud network.", UNKNOWN: "There is not enough information about this receiver.",
};
let windowStart = 0, requests = 0;

function headers(req) {
  const h = new Headers({ "Cache-Control": "no-store", Vary: "Origin", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" });
  const origin = req.headers.get("origin");
  const allowed = new Set(["https://payshield-ai-police.netlify.app", "https://localhost"]);
  if (origin && !allowed.has(origin)) return null;
  if (origin) h.set("Access-Control-Allow-Origin", origin);
  return h;
}
function reply(error, status, h) { return Response.json({ error }, { status, headers: h }); }
function narration(body) {
  if (body?.event === "preview") return "Hello, I am your PayShield voice guide, powered by ElevenLabs. I explain payment risk. Confirm payments using your fingerprint or strong face verification.";
  if (!body || !["result", "complete"].includes(body.event) || !Number.isFinite(body.amount) || body.amount < 1 || body.amount > 200000 || !Number.isInteger(body.score) || body.score < 0 || body.score > 100 || typeof body.synthetic !== "boolean" || typeof body.receiver !== "string" || body.receiver.length > 80) throw new Error("invalid");
  const receiver = body.receiver.replace(/[^\p{L}\p{N} .'-]/gu, "").trim() || "the receiver";
  const amount = body.amount.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  if (body.score > 90) return `Payment blocked. The risk score for ${receiver} is ${body.score} out of 100. PayShield will not continue this payment.`;
  if (body.event === "complete") return body.synthetic ? "Demo payment successful. No real money was transferred." : `The payment request for ${amount} rupees has been handed to your UPI app. Check your bank's confirmation. PayShield has not confirmed a transfer.`;
  if (body.requestApproval) return `OK. Their risk score is ${body.score} out of 100. Say approve to approve the payment, or say cancel to cancel it.`;
  const level = body.score <= 30 ? "low" : body.score <= 70 ? "medium" : "high";
  const reason = Array.isArray(body.reasonCodes) ? body.reasonCodes.slice(0, 8).map(x => allowedReasons[x]).find(Boolean) : "";
  return [body.synthetic ? "This is a prototype payment with a fixed demo score. No real funds will move." : "", `You are paying ${amount} rupees to ${receiver}. The risk score is ${body.score} out of 100, which is ${level} risk.`, body.synthetic ? "" : reason, body.requestApproval ? "Say approve to continue with fingerprint or strong face verification, or say cancel to stop." : "", "Biometric verification is required before continuing."].filter(Boolean).join(" ");
}

export default async (req) => {
  const h = headers(req);
  if (!h) return new Response(null, { status: 403 });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  const configured = Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID && (process.env.PAYSHIELD_VOICE_ACCESS_TOKEN?.length || 0) >= 24);
  if (req.method === "GET") return Response.json({ configured, provider: "ElevenLabs" }, { headers: h });
  if (req.method !== "POST") return reply("Method not allowed.", 405, h);
  if (!configured) return reply("Voice service is not configured.", 503, h);
  const expected = Buffer.from(process.env.PAYSHIELD_VOICE_ACCESS_TOKEN);
  const supplied = Buffer.from((req.headers.get("authorization") || "").replace(/^Bearer /, ""));
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return reply("Incorrect voice access code.", 401, h);
  if (!req.headers.get("content-type")?.includes("application/json")) return reply("JSON is required.", 415, h);
  const raw = await req.text();
  if (Buffer.byteLength(raw) > 4096) return reply("Voice request is too large.", 413, h);
  let text;
  try { text = narration(JSON.parse(raw)); } catch { return reply("Invalid payment narration request.", 400, h); }
  if (Date.now() - windowStart > 60000) { windowStart = Date.now(); requests = 0; }
  if (requests++ >= 12) return reply("Voice request limit reached. Try again in a minute.", 429, h);
  try {
    const voice = encodeURIComponent(process.env.ELEVENLABS_VOICE_ID);
    const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, { method: "POST", headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "Content-Type": "application/json", Accept: "audio/mpeg" }, body: JSON.stringify({ text, model_id: process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2" }), signal: AbortSignal.timeout(20000) });
    if (!upstream.ok) return reply(upstream.status === 429 ? "ElevenLabs credits or rate limit reached." : "ElevenLabs could not generate audio.", 502, h);
    const audio = await upstream.arrayBuffer();
    h.set("Content-Type", "audio/mpeg"); h.set("X-Content-Type-Options", "nosniff");
    return new Response(audio, { headers: h });
  } catch { return reply("Voice service timed out or is unavailable.", 504, h); }
};
