// Full end-to-end verification against the LIVE deployment.
// Usage: BASE=https://trizen-photo-share.vercel.app npx tsx scripts/e2e-live.ts
const BASE = process.env.BASE || 'https://trizen-photo-share.vercel.app';
const SLUG = 'arjun-priya-wedding';
const PIN = '482917';

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}  ${detail}`); }
}

// tiny cookie jar
function jar() {
  const store: Record<string, string> = {};
  return {
    header: () => Object.entries(store).map(([k, v]) => `${k}=${v}`).join('; '),
    absorb: (res: Response) => {
      const sc = res.headers.getSetCookie?.() ?? [];
      for (const c of sc) { const [kv] = c.split(';'); const [k, v] = kv.split('='); store[k] = v; }
    },
  };
}

async function req(path: string, opts: RequestInit & { cookie?: string } = {}) {
  const headers: Record<string, string> = { ...(opts.headers as any) };
  if (opts.cookie) headers['Cookie'] = opts.cookie;
  if (opts.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  return fetch(`${BASE}${path}`, { ...opts, headers, redirect: 'manual' });
}

async function login(email: string, password: string) {
  const j = jar();
  const res = await req('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  j.absorb(res);
  return { status: res.status, cookie: j.header(), body: await res.json().catch(() => ({})) };
}

async function main() {
  console.log(`\nE2E against ${BASE}\n`);

  // --- Happy path: admin login ---
  console.log('Auth:');
  const admin = await login('admin@trizen.com', 'Admin@123456');
  ok('Admin login 200', admin.status === 200, `got ${admin.status}`);
  ok('Admin session cookie set', /token=/.test(admin.cookie));
  ok('Admin role is ADMIN', admin.body?.user?.role === 'ADMIN', JSON.stringify(admin.body?.user));

  const team = await login('team@trizen.com', 'Team@123456');
  ok('Team login 200', team.status === 200, `got ${team.status}`);
  ok('Team role is TEAM', team.body?.user?.role === 'TEAM', JSON.stringify(team.body?.user));

  const bad = await login('admin@trizen.com', 'WrongPassword');
  ok('Wrong password rejected (401)', bad.status === 401, `got ${bad.status}`);

  // --- Events: admin can list, find the seeded event ---
  console.log('\nEvents & authorization:');
  const evRes = await req('/api/events', { cookie: admin.cookie });
  const events = await evRes.json().catch(() => []);
  const eventList = Array.isArray(events) ? events : events.events ?? [];
  ok('Admin lists events 200', evRes.status === 200, `got ${evRes.status}`);
  const event = eventList.find((e: any) => e.name?.includes('Arjun'));
  ok('Seeded event present', !!event, JSON.stringify(eventList).slice(0, 200));
  const eventId = event?.id;

  // Scenario 2: team member cannot publish a gallery (403)
  if (eventId) {
    const pub = await req(`/api/events/${eventId}/gallery`, {
      method: 'POST', cookie: team.cookie,
      body: JSON.stringify({ slug: 'hack-attempt', pin: '000000', photoIds: [] }),
    });
    ok('Scenario 2: team publish blocked (403)', pub.status === 403, `got ${pub.status}`);
  }

  // Scenario 1: unauthenticated access to events API (401)
  const noAuth = await req('/api/events');
  ok('Scenario 1: unauth events access blocked', noAuth.status === 401 || noAuth.status === 403, `got ${noAuth.status}`);

  // Scenario 1b: fabricated event id yields 403/404, never data
  const fakeEv = await req('/api/events/does-not-exist-000/photos', { cookie: team.cookie });
  ok('Scenario 1: bogus event id blocked', [403, 404].includes(fakeEv.status), `got ${fakeEv.status}`);

  // --- Customer gallery happy path ---
  console.log('\nCustomer gallery (PIN flow):');
  const gj = jar();
  const wrongPin = await req(`/api/gallery/${SLUG}/auth`, { method: 'POST', body: JSON.stringify({ pin: '000000' }) });
  ok('Scenario 4: wrong PIN rejected', wrongPin.status === 401, `got ${wrongPin.status}`);

  const authRes = await req(`/api/gallery/${SLUG}/auth`, { method: 'POST', body: JSON.stringify({ pin: PIN }) });
  gj.absorb(authRes);
  ok('Correct PIN accepted (200)', authRes.status === 200, `got ${authRes.status}`);

  const photosRes = await req(`/api/gallery/${SLUG}/photos`, { cookie: gj.header() });
  const gallery = await photosRes.json().catch(() => ({}));
  ok('Authed photos list 200', photosRes.status === 200, `got ${photosRes.status}`);
  ok('Exactly 3 published photos', gallery?.photos?.length === 3, `got ${gallery?.photos?.length}`);

  // Scenario 5: the unpublished 4th photo must not appear
  const names = (gallery?.photos ?? []).map((p: any) => p.filename).join(',');
  ok('Scenario 5: unpublished photo hidden', !names.includes('Behind_The_Scenes_Raw_004'), names);

  // Filebase presigned GET actually serves bytes through the deployed app
  const viewUrl = gallery?.photos?.[0]?.viewUrl;
  ok('Photo has viewUrl', !!viewUrl, JSON.stringify(gallery?.photos?.[0] ?? {}).slice(0, 150));
  if (viewUrl) {
    const img = await fetch(viewUrl);
    const buf = Buffer.from(await img.arrayBuffer());
    ok('Presigned GET returns JPEG bytes', img.ok && buf.length > 0 && buf[0] === 0xff && buf[1] === 0xd8,
       `status=${img.status} len=${buf.length} magic=${buf[0]?.toString(16)}${buf[1]?.toString(16)}`);
  }

  // Photos list without a gallery cookie stays blocked
  const noCookie = await req(`/api/gallery/${SLUG}/photos`);
  ok('Scenario 5: photos need gallery session', noCookie.status === 401, `got ${noCookie.status}`);

  // Scenario 4: rate limit after repeated wrong PINs
  console.log('\nScenario 4: rate limiting:');
  let blocked = false, lastStatus = 0;
  for (let i = 0; i < 14; i++) {
    const r = await req(`/api/gallery/${SLUG}/auth`, { method: 'POST', body: JSON.stringify({ pin: '111111' }) });
    lastStatus = r.status;
    if (r.status === 429) { blocked = true; break; }
  }
  ok('Rate limiter engages (429) on brute force', blocked, `last status ${lastStatus}`);

  console.log(`\n${'='.repeat(40)}\nRESULT: ${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error('E2E crashed:', e); process.exit(1); });
