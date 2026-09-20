import { timingSafeEqual } from "node:crypto";
import { buildNarration } from "@/lib/narration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Deliberately small, process-local credit budget for a private, single-instance prototype.
let windowStart = 0;
let requests = 0;

function cors(req: Request): Headers | null {
  const headers = new Headers({ "Cache-Control": "no-store", Vary: "Origin" });
  const origin = req.headers.get("origin");
  const allowed = new Set([new URL(req.url).origin, "https://localhost",
    ...(process.env.PAYSHIELD_VOICE_ALLOWED_ORIGINS ?? "").split(",").map(x => x.trim()).filter(Boolean)]);
  if (origin && !allowed.has(origin)) return null;
  if (origin) headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return headers;
}

const reply = (error: string, status: number, headers: Headers) => Response.json({ error }, { status, headers });

function configured() {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim() && process.env.ELEVENLABS_VOICE_ID?.trim() &&
    (process.env.PAYSHIELD_VOICE_ACCESS_TOKEN?.length ?? 0) >= 24);
}

export async function OPTIONS(req: Request) {
  const headers = cors(req);
  return new Response(null, { status: headers ? 204 : 403, headers: headers ?? undefined });
}

export async function GET(req: Request) {
  const headers = cors(req);
  if (!headers) return new Response(null, { status: 403 });
  return Response.json({ configured: configured(), provider: "ElevenLabs" }, { headers });
}

export async function POST(req: Request) {
  const headers = cors(req);
  if (!headers) return new Response(null, { status: 403 });
  if (!configured()) return reply("Voice service is not configured yet. Add the ElevenLabs settings on the backend.", 503, headers);
  const expected = Buffer.from(process.env.PAYSHIELD_VOICE_ACCESS_TOKEN!);
  const supplied = Buffer.from((req.headers.get("authorization") ?? "").replace(/^Bearer /, ""));
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied))
    return reply("Incorrect voice access code. Check Voice settings.", 401, headers);
  if (!req.headers.get("content-type")?.includes("application/json")) return reply("JSON is required.", 415, headers);
  // Bound even chunked requests before reading/forwarding data to the paid service.
  const reader = req.body?.getReader();
  if (!reader) return reply("Missing request.", 400, headers);
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 4096) { await reader.cancel(); return reply("Voice request is too large.", 413, headers); }
      chunks.push(value);
    }
  } catch { return reply("Unable to read voice request.", 400, headers); }
  let text: string;
  try { text = buildNarration(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
  catch { return reply("Invalid payment narration request.", 400, headers); }
  if (Date.now() - windowStart > 60_000) { windowStart = Date.now(); requests = 0; }
  if (requests >= 12) { headers.set("Retry-After", "60"); return reply("Voice request limit reached. Try again in a minute.", 429, headers); }
  requests++;
  try {
    const voice = encodeURIComponent(process.env.ELEVENLABS_VOICE_ID!.trim());
    const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY!.trim(), "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2" }),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!upstream.ok) {
      const message = upstream.status === 401 || upstream.status === 403
        ? "The backend ElevenLabs key or voice permission needs checking."
        : upstream.status === 429 ? "ElevenLabs credits or rate limit reached. Check your account."
        : "ElevenLabs could not generate audio. Try again shortly.";
      return reply(message, 502, headers);
    }
    const audio = await upstream.arrayBuffer();
    if (!audio.byteLength) return reply("The voice service returned empty audio.", 502, headers);
    headers.set("Content-Type", "audio/mpeg");
    headers.set("X-Content-Type-Options", "nosniff");
    return new Response(audio, { headers });
  } catch { return reply("Voice service timed out or is unavailable. You can still use the payment screen.", 504, headers); }
}
