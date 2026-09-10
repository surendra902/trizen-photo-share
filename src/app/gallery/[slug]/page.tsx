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
      <div className="flex-1 flex items-center justify-center p-8 text-slate-400 text-sm">
        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mr-3"></div>
        Opening gallery...
      </div>
    );
  }

  // 1. PIN-Protected Gating Screen
  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm p-8 rounded-2xl border border-slate-800 bg-slate-900/90 backdrop-blur-xl shadow-2xl text-center space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto shadow-inner">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>

          <div className="space-y-1">
            <h1 className="text-xl font-bold text-white tracking-tight">Private Client Gallery</h1>
            <p className="text-xs text-slate-400">
              Please enter the 6-digit access PIN provided by your photographer to view this gallery.
            </p>
          </div>

          {pinError && (
            <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs text-left flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{pinError}</span>
            </div>
          )}

          <form onSubmit={handleVerifyPin} className="space-y-4">
            <div>
              <input
                type="password"
                required
                autoFocus
                inputMode="numeric"
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter PIN (e.g. 482917)"
                className="w-full text-center tracking-[0.3em] font-mono text-xl py-3 px-4 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={pinLoading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50 cursor-pointer"
            >
              {pinLoading ? 'Verifying...' : 'Unlock Gallery'}
            </button>
          </form>

          <p className="text-[11px] text-slate-500">
            PIN is verified server-side against a salted hash. Verified sessions expire after 24 hours.
          </p>
        </div>
      </div>
    );
  }

  // 2. Authenticated Customer Gallery View
  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header Banner */}
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          Verified Client Access
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          {gallery?.event.name}
        </h1>
        {gallery?.event.description && (
          <p className="text-sm text-slate-400">{gallery.event.description}</p>
        )}
        <div className="flex items-center justify-center gap-4 text-xs text-slate-500 pt-2">
          <span>{gallery?.totalPhotos} Curated Photographs</span>
          <span>•</span>
          <span>
            Published on{' '}
            {gallery?.publishedAt ? new Date(gallery.publishedAt).toLocaleDateString() : 'Recent'}
          </span>
        </div>
      </div>

      {/* Gallery Photo Grid */}
      {gallery && gallery.photos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {gallery.photos.map((photo, index) => (
            <div
              key={photo.id}
              onClick={() => setActivePhotoIndex(index)}
              className="group cursor-pointer relative aspect-square rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 hover:border-slate-700 shadow-md transition-all hover:scale-[1.02]"
            >
              <img
                src={photo.viewUrl}
                alt={photo.filename}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                <span className="text-xs text-white font-medium truncate">{photo.filename}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center p-12 text-slate-400 text-sm">
          No published photos found in this gallery.
        </div>
      )}

      {/* Fullscreen Lightbox Modal */}
      {activePhotoIndex !== null && gallery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4">
          <button
            onClick={() => setActivePhotoIndex(null)}
            className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-full bg-slate-900/60 hover:bg-slate-800 text-lg transition-colors cursor-pointer"
          >
            ✕
          </button>

          {/* Previous Button */}
          {activePhotoIndex > 0 && (
            <button
              onClick={() => setActivePhotoIndex(activePhotoIndex - 1)}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white p-3 rounded-full bg-slate-900/60 hover:bg-slate-800 transition-colors cursor-pointer"
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
            <div className="mt-4 flex items-center justify-between w-full text-xs text-slate-400 px-2">
              <span>{gallery.photos[activePhotoIndex].filename}</span>
              <div className="flex items-center gap-4">
                <span>
                  {activePhotoIndex + 1} of {gallery.photos.length}
                </span>
                <a
                  href={gallery.photos[activePhotoIndex].viewUrl}
                  download={gallery.photos[activePhotoIndex].filename}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors"
                >
                  Download Photo ⤓
                </a>
              </div>
            </div>
          </div>

          {/* Next Button */}
          {activePhotoIndex < gallery.photos.length - 1 && (
            <button
              onClick={() => setActivePhotoIndex(activePhotoIndex + 1)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white p-3 rounded-full bg-slate-900/60 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              ›
            </button>
          )}
        </div>
      )}
    </div>
  );
}
