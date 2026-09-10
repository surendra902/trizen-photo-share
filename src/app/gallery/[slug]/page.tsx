'use client';

import { useState, useEffect, use } from 'react';

interface PublishedPhoto {
  id: string;
  filename: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
  order: number;
  viewUrl: string;
}

interface GalleryData {
  event: {
    name: string;
    description: string | null;
  };
  publishedAt: string;
  totalPhotos: number;
  photos: PublishedPhoto[];
}

export default function CustomerGalleryPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;

  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [gallery, setGallery] = useState<GalleryData | null>(null);

  // PIN Form State
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  // Lightbox Modal
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);

  const checkAccessAndLoad = async () => {
    try {
      const res = await fetch(`/api/gallery/${slug}/photos`);
      if (res.ok) {
        const data = await res.json();
        setGallery(data);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error(err);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAccessAndLoad();
  }, [slug]);

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    setPinLoading(true);

    try {
      const res = await fetch(`/api/gallery/${slug}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid PIN');
      }

      await checkAccessAndLoad();
    } catch (err) {
      setPinError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setPinLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-muted text-sm">
        <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin mr-3"></div>
        Opening gallery…
      </div>
    );
  }

  // 1. PIN-Protected Gating Screen
  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex items-center justify-center p-5">
        <div className="w-full max-w-sm card p-8 text-center rise">
          <div className="w-14 h-14 rounded-full border border-line bg-ink-sunken text-accent flex items-center justify-center mx-auto">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>

          <div className="mt-6 mb-6">
            <p className="eyebrow mb-3">Private Gallery</p>
            <h1 className="font-display text-2xl tracking-tight">Enter your PIN.</h1>
            <p className="text-sm text-muted mt-2">
              Enter the 6-digit access PIN your photographer shared with you.
            </p>
          </div>

          {pinError && (
            <div className="mb-5 p-3 rounded-lg border border-red-500/40 bg-red-500/10 text-red-300 text-sm text-left flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{pinError}</span>
            </div>
          )}

          <form onSubmit={handleVerifyPin} className="space-y-4">
            <input
              type="password"
              required
              autoFocus
              inputMode="numeric"
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="482917"
              className="field text-center tracking-[0.4em] font-mono text-xl !py-3.5"
            />
            <button type="submit" disabled={pinLoading} className="btn btn-primary w-full">
              {pinLoading ? 'Verifying…' : 'Unlock gallery'}
            </button>
          </form>

          <p className="mt-6 text-xs text-faint">
            Verified server-side against a salted hash. Sessions expire after 24 hours.
          </p>
        </div>
      </div>
    );
  }

  // 2. Authenticated Customer Gallery View
  return (
    <div className="flex-1 max-w-6xl w-full mx-auto px-5 sm:px-8 py-14">
      {/* Header */}
      <div className="max-w-2xl rise">
        <div className="inline-flex items-center gap-2 eyebrow mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
          Verified client access
        </div>
        <h1 className="font-display text-4xl sm:text-6xl tracking-tight leading-[1.05]">
          {gallery?.event.name}
        </h1>
        {gallery?.event.description && (
          <p className="mt-5 text-lg text-muted leading-relaxed">{gallery.event.description}</p>
        )}
        <div className="mt-6 flex items-center gap-4 text-sm text-faint font-mono">
          <span>{gallery?.totalPhotos} photographs</span>
          <span className="text-line">/</span>
          <span>
            Published {gallery?.publishedAt ? new Date(gallery.publishedAt).toLocaleDateString() : 'recently'}
          </span>
        </div>
      </div>

      {/* Photo Grid */}
      {gallery && gallery.photos.length > 0 ? (
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {gallery.photos.map((photo, index) => (
            <div
              key={photo.id}
              onClick={() => setActivePhotoIndex(index)}
              className="group cursor-pointer relative aspect-[4/3] rounded-lg overflow-hidden bg-ink-raised border border-line hover:border-accent/60 transition-all"
            >
              <img
                src={photo.viewUrl}
                alt={photo.filename}
                className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                <span className="text-xs text-paper font-mono truncate">{photo.filename}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-12 text-center p-12 card text-muted text-sm">
          No published photos found in this gallery.
        </div>
      )}

      {/* Fullscreen Lightbox Modal */}
      {activePhotoIndex !== null && gallery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/97 backdrop-blur-md p-4">
          <button
            onClick={() => setActivePhotoIndex(null)}
            className="absolute top-4 right-4 text-muted hover:text-paper p-2 rounded-full border border-line hover:border-accent bg-ink-raised text-lg transition-colors cursor-pointer"
            aria-label="Close"
          >
            ✕
          </button>

          {/* Previous Button */}
          {activePhotoIndex > 0 && (
            <button
              onClick={() => setActivePhotoIndex(activePhotoIndex - 1)}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-paper p-3 rounded-full border border-line hover:border-accent bg-ink-raised transition-colors cursor-pointer"
              aria-label="Previous"
            >
              ‹
            </button>
          )}

          {/* Main Image View */}
          <div className="max-w-5xl max-h-[85vh] flex flex-col items-center justify-center">
            <img
              src={gallery.photos[activePhotoIndex].viewUrl}
              alt={gallery.photos[activePhotoIndex].filename}
              className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl"
            />
            <div className="mt-4 flex items-center justify-between w-full text-xs text-muted font-mono px-2">
              <span>{gallery.photos[activePhotoIndex].filename}</span>
              <div className="flex items-center gap-4">
                <span>
                  {activePhotoIndex + 1} / {gallery.photos.length}
                </span>
                <a
                  href={gallery.photos[activePhotoIndex].viewUrl}
                  download={gallery.photos[activePhotoIndex].filename}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1 rounded-md border border-line hover:border-accent text-paper transition-colors"
                >
                  Download ⤓
                </a>
              </div>
            </div>
          </div>

          {/* Next Button */}
          {activePhotoIndex < gallery.photos.length - 1 && (
            <button
              onClick={() => setActivePhotoIndex(activePhotoIndex + 1)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-paper p-3 rounded-full border border-line hover:border-accent bg-ink-raised transition-colors cursor-pointer"
              aria-label="Next"
            >
              ›
            </button>
          )}
        </div>
      )}
    </div>
  );
}
