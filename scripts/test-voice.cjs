const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const Module = require('node:module');
function load(entry) {
  const code = buildSync({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text;
  const mod = new Module(entry, module);
  mod._compile(code, entry);
  return mod.exports;
}
const { buildNarration } = load('lib/narration.ts');
const sample = { event: 'result', amount: 2000, receiver: 'Suresh', score: 10, synthetic: true };
assert.match(buildNarration(sample), /fixed demo score/);
assert.equal(buildNarration({...sample,requestApproval:true}), 'OK. Their risk score is 10 out of 100. Say approve to approve the payment, or say cancel to cancel it.');
assert.match(buildNarration({ ...sample, score: 80 }), /high risk/);
assert.match(buildNarration({ ...sample, score: 91, event: 'complete' }), /^Payment blocked/);
assert.match(buildNarration({ ...sample, event: 'complete' }), /No real money was transferred/);
assert.match(buildNarration({ ...sample, event: 'complete', synthetic: false }), /has not confirmed a transfer/);
for (const amount of [0, -1, Infinity, 200001]) assert.throws(() => buildNarration({ ...sample, amount }));
assert.throws(() => buildNarration({ ...sample, score: 101 }));
process.env.ELEVENLABS_API_KEY = 'test-provider-key';
process.env.ELEVENLABS_VOICE_ID = 'test-voice';
process.env.PAYSHIELD_VOICE_ACCESS_TOKEN = 'test-access-token-long-enough';
const route = load('app/api/voice/route.ts');
let calls = 0;
global.fetch = async (url, options) => {
  calls++;
  assert.match(url, /^https:\/\/api.elevenlabs.io\/v1\/text-to-speech\/test-voice/);
  assert.equal(options.headers['xi-api-key'], 'test-provider-key');
  assert.match(JSON.parse(options.body).text, /PayShield/);
  return new Response(new Uint8Array([73, 68, 51]), { headers: { 'Content-Type': 'audio/mpeg' } });
};
function req(body = { event: 'preview' }, headers = {}) {
  return new Request('http://localhost:3010/api/voice', { method: 'POST', headers: {
    'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.PAYSHIELD_VOICE_ACCESS_TOKEN, ...headers,
  }, body: JSON.stringify(body) });
}
(async () => {
  assert.equal((await route.POST(req({}, { Authorization: 'Bearer wrong' }))).status, 401);
  assert.equal((await route.POST(req({}, { Origin: 'https://evil.example' }))).status, 403);
  assert.equal((await route.POST(req({ event: 'anything' }))).status, 400);
  assert.equal((await route.POST(req({ event: 'preview', extra: 'x'.repeat(5000) }))).status, 413);
  assert.equal(calls, 0);
  const response = await route.POST(req(undefined, { Origin: 'https://localhost' }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://localhost');
  assert.equal(response.headers.get('Content-Type'), 'audio/mpeg');
  assert.equal((await response.arrayBuffer()).byteLength, 3);
  global.fetch = async () => new Response('private upstream error', { status: 401 });
  const failed = await route.POST(req());
  assert.equal(failed.status, 502);
  assert.ok(!(await failed.text()).includes('private upstream error'));
  for (let i = 0; i < 10; i++) await route.POST(req());
  assert.equal((await route.POST(req())).status, 429);
  console.log('PASS: narration, block policy, input validation, authorization, CORS, MP3, sanitized errors, rate limit. No provider credits used.');
})().catch(error => { console.error(error); process.exitCode = 1; });
