import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex-1 flex flex-col justify-center items-center py-16 px-4 sm:px-6 lg:px-8">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[60rem] h-[30rem] bg-gradient-to-tr from-indigo-500/20 via-purple-500/15 to-pink-500/10 blur-3xl opacity-60 rounded-full" />
      </div>

      <div className="max-w-4xl w-full text-center space-y-8">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
          TrizenAI Full-Stack Challenge — Production Build
        </div>

        {/* Heading */}
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Collaborative Event Photography{' '}
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Without Friction
          </span>
        </h1>

        <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-400 leading-relaxed">
          Photography teams upload collaboratively, admins curate and publish with one click, and clients
          access secure, PIN-protected galleries instantly with zero account creation required.
        </p>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap justify-center gap-4 pt-4">
          <Link
            href="/login"
            className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm shadow-xl shadow-indigo-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
          >
            Launch Staff Portal (Admin / Team)
          </Link>
          <Link
            href="/gallery/arjun-priya-wedding"
            className="px-6 py-3.5 rounded-xl border border-slate-700 bg-slate-900/60 hover:bg-slate-800/80 text-slate-200 font-semibold text-sm transition-all backdrop-blur-sm transform hover:-translate-y-0.5"
          >
            View Customer Gallery (PIN: 482917) →
          </Link>
        </div>

        {/* Demo Credentials Grid */}
        <div className="pt-12 text-left">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 text-center mb-6">
            Quick-Start Demo Credentials (Pre-Seeded)
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Admin Credential Card */}
            <div className="p-5 rounded-2xl border border-indigo-500/30 bg-slate-900/70 backdrop-blur-md shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 px-3 py-1 bg-indigo-500/20 text-indigo-400 text-xs font-bold rounded-bl-xl uppercase">
                Admin
              </div>
              <h3 className="text-base font-bold text-white mb-1">Lead Admin</h3>
              <p className="text-xs text-slate-400 mb-4">Creates events, adds team, curates photos & publishes</p>
              <div className="space-y-1.5 text-xs font-mono bg-slate-950/80 p-3 rounded-lg border border-slate-800">
                <div className="text-slate-300">
                  <span className="text-slate-500">Email:</span> admin@trizen.com
                </div>
                <div className="text-slate-300">
                  <span className="text-slate-500">Pass:</span> Admin@123456
                </div>
              </div>
              <Link
                href="/login?email=admin@trizen.com"
                className="mt-4 block text-center text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Sign in as Admin →
              </Link>
            </div>

            {/* Team Member Credential Card */}
            <div className="p-5 rounded-2xl border border-purple-500/30 bg-slate-900/70 backdrop-blur-md shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 px-3 py-1 bg-purple-500/20 text-purple-400 text-xs font-bold rounded-bl-xl uppercase">
                Team
              </div>
              <h3 className="text-base font-bold text-white mb-1">Alex Photographer</h3>
              <p className="text-xs text-slate-400 mb-4">Views assigned events & uploads high-res photos</p>
              <div className="space-y-1.5 text-xs font-mono bg-slate-950/80 p-3 rounded-lg border border-slate-800">
                <div className="text-slate-300">
                  <span className="text-slate-500">Email:</span> team@trizen.com
                </div>
                <div className="text-slate-300">
                  <span className="text-slate-500">Pass:</span> Team@123456
                </div>
              </div>
              <Link
                href="/login?email=team@trizen.com"
                className="mt-4 block text-center text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors"
              >
                Sign in as Team Member →
              </Link>
            </div>

            {/* Customer Demo Card */}
            <div className="p-5 rounded-2xl border border-pink-500/30 bg-slate-900/70 backdrop-blur-md shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 px-3 py-1 bg-pink-500/20 text-pink-400 text-xs font-bold rounded-bl-xl uppercase">
                Customer
              </div>
              <h3 className="text-base font-bold text-white mb-1">Arjun & Priya Gallery</h3>
              <p className="text-xs text-slate-400 mb-4">Customer view protected by 6-digit PIN</p>
              <div className="space-y-1.5 text-xs font-mono bg-slate-950/80 p-3 rounded-lg border border-slate-800">
                <div className="text-slate-300">
                  <span className="text-slate-500">Slug:</span> /gallery/arjun-priya-wedding
                </div>
                <div className="text-slate-300">
                  <span className="text-slate-500">PIN:</span> 482917
                </div>
              </div>
              <Link
                href="/gallery/arjun-priya-wedding"
                className="mt-4 block text-center text-xs font-semibold text-pink-400 hover:text-pink-300 transition-colors"
              >
                Open Demo Gallery →
              </Link>
            </div>
          </div>
        </div>

        {/* 5 Security Scenarios Guarantee */}
        <div className="pt-12 text-left border-t border-slate-800/80">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <svg
              className="w-5 h-5 text-emerald-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            Production-Grade Security Verification (PDF §6)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/40">
              <span className="font-semibold text-indigo-300 block mb-1">1. User Cross-Event Access</span>
              <p className="text-slate-400">
                Server-side role check blocks team members from accessing unassigned events with HTTP 403.
              </p>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/40">
              <span className="font-semibold text-purple-300 block mb-1">2. Team Publishing Gallery</span>
              <p className="text-slate-400">
                Gallery creation endpoint enforces Admin-only role authorization before performing any writes.
              </p>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/40">
              <span className="font-semibold text-pink-300 block mb-1">3. Failed Upload Isolation</span>
              <p className="text-slate-400">
                Photos stay in PENDING status until storage existence is confirmed via server verification.
              </p>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/40">
              <span className="font-semibold text-amber-300 block mb-1">4. Incorrect PIN Protection</span>
              <p className="text-slate-400">
                Bcrypt comparison with IP rate-limiting (max 10 tries) prevents brute force attacks.
              </p>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/40">
              <span className="font-semibold text-emerald-300 block mb-1">5. Unpublished Photo Secrecy</span>
              <p className="text-slate-400">
                Client galleries only query photos explicitly joined to the published gallery. Raw storage keys are private.
              </p>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/40">
              <span className="font-semibold text-cyan-300 block mb-1">6. Object Storage Protocol</span>
              <p className="text-slate-400">
                No binary image bytes in the database. Metadata only; files stored via S3/R2 presigned URLs.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
