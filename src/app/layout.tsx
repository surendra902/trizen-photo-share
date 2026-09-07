import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Link from 'next/link';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Trizen PhotoShare | Event Photography & Customer Galleries',
  description:
    'Collaborative event photography platform with role-based uploads, admin curation, and PIN-protected customer galleries.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}>
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white font-sans">
        {/* Global Navigation Header */}
        <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-5 h-5"
                >
                  <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                  <circle cx="12" cy="13" r="3" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  Trizen PhotoShare
                </span>
              </div>
            </Link>

            <nav className="flex items-center gap-4">
              <Link
                href="/gallery/arjun-priya-wedding"
                className="text-xs sm:text-sm font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800/50 transition-colors flex items-center gap-1.5"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Demo Gallery
              </Link>
              <Link
                href="/dashboard"
                className="text-xs sm:text-sm font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800/50 transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/login"
                className="text-xs sm:text-sm font-medium bg-gradient-to-r from-indigo-500 to-violet-600 text-white px-4 py-2 rounded-lg shadow-sm hover:from-indigo-600 hover:to-violet-700 transition-all active:scale-95"
              >
                Sign In
              </Link>
            </nav>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col">{children}</main>

        {/* Footer */}
        <footer className="border-t border-slate-800/60 bg-slate-950 py-8 text-slate-500 text-xs text-center">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p>© 2026 TrizenAI Internship Challenge. Built with Next.js, Prisma, and Cloud Object Storage.</p>
            <div className="flex gap-4">
              <span>Demo PIN: <strong className="text-slate-300">482917</strong></span>
              <span>•</span>
              <span>Roles: <strong className="text-slate-300">Admin & Team</strong></span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
