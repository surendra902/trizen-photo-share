import type { Metadata } from 'next';
import { Fraunces, Inter, Geist_Mono } from 'next/font/google';
import './globals.css';
import Link from 'next/link';

const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  display: 'swap',
});

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
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
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-ink text-paper">
        {/* Global Navigation Header */}
        <header className="sticky top-0 z-40 w-full border-b border-line-soft bg-ink/85 backdrop-blur-md">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-baseline gap-2 group">
              <span className="font-display text-2xl leading-none tracking-tight">
                Trizen<span className="text-accent">.</span>
              </span>
              <span className="eyebrow hidden sm:inline pb-0.5">PhotoShare</span>
            </Link>

            <nav className="flex items-center gap-5 sm:gap-7">
              <Link
                href="/gallery/arjun-priya-wedding"
                className="link-underline text-sm text-muted hover:text-paper transition-colors hidden sm:inline-flex items-center gap-2"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
                Demo Gallery
              </Link>
              <Link
                href="/dashboard"
                className="link-underline text-sm text-muted hover:text-paper transition-colors"
              >
                Dashboard
              </Link>
              <Link href="/login" className="btn btn-primary !px-5 !py-2 text-sm">
                Sign In
              </Link>
            </nav>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col">{children}</main>

        {/* Footer */}
        <footer className="border-t border-line-soft bg-ink">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <p className="text-faint">
              © 2026 TrizenAI Internship Challenge — built with Next.js, Prisma & cloud object storage.
            </p>
            <div className="flex items-center gap-4 text-faint font-mono">
              <span>
                Demo PIN <span className="text-accent">482917</span>
              </span>
              <span className="text-line">/</span>
              <span>
                Roles <span className="text-muted">Admin · Team</span>
              </span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
