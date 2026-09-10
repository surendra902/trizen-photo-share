import Link from 'next/link';

const CREDENTIALS = [
  {
    role: 'Admin / Lead',
    name: 'Lead Admin',
    blurb: 'Creates events, assigns photographers, curates and publishes galleries.',
    email: 'admin@trizen.com',
    pass: 'Admin@123456',
    href: '/login?email=admin@trizen.com',
    cta: 'Sign in as Admin',
  },
  {
    role: 'Team Member',
    name: 'Alex Photographer',
    blurb: 'Views assigned events and uploads high-resolution photographs.',
    email: 'team@trizen.com',
    pass: 'Team@123456',
    href: '/login?email=team@trizen.com',
    cta: 'Sign in as Team',
  },
  {
    role: 'Customer',
    name: 'Arjun & Priya Gallery',
    blurb: 'Opens a published gallery with a 6-digit PIN — no account required.',
    email: '/gallery/arjun-priya-wedding',
    pass: 'PIN 482917',
    href: '/gallery/arjun-priya-wedding',
    cta: 'Open the gallery',
  },
];

const SECURITY = [
  {
    title: 'Cross-event access',
    body: 'Server-side role checks block team members from events they are not assigned to — a hard 403, never a leak.',
  },
  {
    title: 'Team publishing attempt',
    body: 'Gallery publishing is admin-only and enforced on the server before any write. Forged requests are rejected.',
  },
  {
    title: 'Failed upload isolation',
    body: 'Photos stay PENDING until storage existence is confirmed. Aborted uploads never surface in any listing.',
  },
  {
    title: 'Incorrect PIN',
    body: 'PINs are compared against a bcrypt hash with per-client rate limiting after ten failed attempts.',
  },
  {
    title: 'Unpublished photo secrecy',
    body: 'Customer galleries only join explicitly published photos. Everything else has no join row and is never served.',
  },
  {
    title: 'Object-storage protocol',
    body: 'No image bytes touch the database. Files live in S3-compatible storage behind short-lived presigned URLs.',
  },
];

export default function HomePage() {
  return (
    <div className="w-full">
      {/* ── Hero ── */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 pt-20 pb-16 sm:pt-28 sm:pb-24">
        <div className="max-w-3xl rise">
          <p className="eyebrow mb-6">TrizenAI Full-Stack Challenge — Production Build</p>
          <h1 className="font-display text-5xl sm:text-7xl leading-[1.02] tracking-tight">
            Event photography,
            <br />
            delivered with <span className="text-accent italic">intent.</span>
          </h1>
          <p className="mt-8 text-lg text-muted leading-relaxed max-w-xl">
            Photography teams upload together. Admins curate and publish in a click. Clients open a
            secure, PIN-protected gallery instantly — no account, no friction.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/login" className="btn btn-primary">
              Enter the staff portal
            </Link>
            <Link href="/gallery/arjun-priya-wedding" className="btn btn-ghost">
              View a customer gallery →
            </Link>
          </div>
        </div>
      </section>

      {/* ── 01 · Demo access ── */}
      <section className="border-t border-line-soft">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-20">
          <div className="flex items-baseline gap-4 mb-12">
            <span className="eyebrow text-accent">01</span>
            <h2 className="font-display text-3xl sm:text-4xl tracking-tight">Demo access.</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-line rounded-xl overflow-hidden border border-line">
            {CREDENTIALS.map((c) => (
              <div
                key={c.role}
                className="bg-ink-raised p-7 flex flex-col hover:bg-ink-sunken/40 transition-colors"
              >
                <span className="eyebrow">{c.role}</span>
                <h3 className="font-display text-2xl mt-3 mb-2">{c.name}</h3>
                <p className="text-sm text-muted leading-relaxed flex-1">{c.blurb}</p>
                <div className="mt-5 space-y-1 font-mono text-xs bg-ink-sunken border border-line rounded-lg p-3.5">
                  <div className="text-muted break-all">
                    <span className="text-faint">{c.role === 'Customer' ? 'link' : 'email'} </span>
                    {c.email}
                  </div>
                  <div className="text-muted">
                    <span className="text-faint">{c.role === 'Customer' ? 'pin' : 'pass'} </span>
                    {c.pass}
                  </div>
                </div>
                <Link
                  href={c.href}
                  className="link-underline mt-5 self-start text-sm font-medium text-accent"
                >
                  {c.cta} →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 02 · Security model ── */}
      <section className="border-t border-line-soft">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-20">
          <div className="flex items-baseline gap-4 mb-4">
            <span className="eyebrow text-accent">02</span>
            <h2 className="font-display text-3xl sm:text-4xl tracking-tight">The security model.</h2>
          </div>
          <p className="text-muted max-w-xl mb-12">
            Every scenario in the brief is enforced server-side and covered by the automated test
            suite — not left to the client.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-10">
            {SECURITY.map((s, i) => (
              <div key={s.title} className="border-t border-line pt-5">
                <span className="font-mono text-sm text-accent">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="font-display text-xl mt-2 mb-2">{s.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
