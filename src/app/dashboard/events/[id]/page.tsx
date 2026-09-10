'use client';

import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface PhotoItem {
  id: string;
  filename: string;
  fileSize: number;
  mimeType: string;
  storageKey: string;
  createdAt: string;
  uploadedBy: { id: string; name: string; email: string };
  viewUrl: string;
  isPublished: boolean;
}

interface EventDetail {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  createdBy: { id: string; name: string; email: string };
  members: Array<{ user: { id: string; name: string; email: string } }>;
  gallery: { id: string; slug: string; publishedAt: string } | null;
  _count: { photos: number };
}

interface UploadStatus {
  filename: string;
  progress: number;
  status: 'pending' | 'uploading' | 'confirming' | 'success' | 'error';
  error?: string;
}

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const eventId = resolvedParams.id;
  const router = useRouter();

  const [userRole, setUserRole] = useState<'ADMIN' | 'TEAM'>('TEAM');
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbiddenError, setForbiddenError] = useState('');

  // Team Member Management
  const [memberEmail, setMemberEmail] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [memberMessage, setMemberMessage] = useState('');

  // Upload Management
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadsList, setUploadsList] = useState<UploadStatus[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Selection & Publishing (Admin Only)
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{
    slug: string;
    pin: string;
    galleryUrl: string;
  } | null>(null);

  const loadEventAndPhotos = async () => {
    try {
      // 1. Current user
      const meRes = await fetch('/api/auth/me');
      if (!meRes.ok) {
        router.push('/login');
        return;
      }
      const me = await meRes.json();
      setUserRole(me.user.role);

      // 2. Event details
      const evRes = await fetch(`/api/events/${eventId}`);
      if (evRes.status === 403) {
        setForbiddenError('Access Denied: You are not assigned to this event.');
        setLoading(false);
        return;
      }
      if (!evRes.ok) throw new Error('Event not found');
      const evData = await evRes.json();
      setEvent(evData.event);

      // 3. Scoped Photos
      const phRes = await fetch(`/api/events/${eventId}/photos`);
      if (phRes.ok) {
        const phData = await phRes.json();
        const loadedPhotos = phData.photos || [];
        setPhotos(loadedPhotos);

        // Pre-select published photos if admin
        if (me.user.role === 'ADMIN') {
          const alreadyPublished = loadedPhotos
            .filter((p: PhotoItem) => p.isPublished)
            .map((p: PhotoItem) => p.id);
          setSelectedPhotoIds(alreadyPublished);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEventAndPhotos();
  }, [eventId]);

  // Handle Adding Team Member (Admin Only)
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingMember(true);
    setMemberMessage('');

    try {
      const res = await fetch(`/api/events/${eventId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: memberEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add member');

      setMemberEmail('');
      setMemberMessage(`Added ${data.member?.name || 'member'} successfully!`);
      loadEventAndPhotos();
    } catch (err) {
      setMemberMessage(`Error: ${err instanceof Error ? err.message : 'Something went wrong'}`);
    } finally {
      setAddingMember(false);
    }
  };

  // Handle File Uploads (Multiple)
  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const fileArray = Array.from(files);

    const initialStatuses: UploadStatus[] = fileArray.map((f) => ({
      filename: f.name,
      progress: 0,
      status: 'pending',
    }));
    setUploadsList(initialStatuses);

    try {
      // Step 1: Request presigned URLs
      const presignPayload = {
        files: fileArray.map((f) => ({
          filename: f.name,
          mimeType: f.type || 'image/jpeg',
          fileSize: f.size,
        })),
      };

      const presignRes = await fetch(`/api/events/${eventId}/uploads/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(presignPayload),
      });

      if (!presignRes.ok) {
        const err = await presignRes.json();
        throw new Error(err.error || 'Presign failed');
      }

      const { uploads } = await presignRes.json();

      // Step 2: Upload each file directly to presigned URL
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        const uploadMeta = uploads[i];

        setUploadsList((prev) =>
          prev.map((item, idx) => (idx === i ? { ...item, status: 'uploading', progress: 50 } : item))
        );

        try {
          const putRes = await fetch(uploadMeta.uploadUrl, {
            method: uploadMeta.method || 'PUT',
            headers: {
              'Content-Type': file.type || 'image/jpeg',
            },
            body: file,
          });

          if (!putRes.ok) {
            throw new Error(`Storage returned ${putRes.status}`);
          }

          // Step 3: Confirm with backend
          setUploadsList((prev) =>
            prev.map((item, idx) => (idx === i ? { ...item, status: 'confirming', progress: 90 } : item))
          );

          const confirmRes = await fetch(`/api/events/${eventId}/uploads/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ photoId: uploadMeta.photoId }),
          });

          if (!confirmRes.ok) {
            const confirmErr = await confirmRes.json();
            throw new Error(confirmErr.error || 'Confirm failed');
          }

          setUploadsList((prev) =>
            prev.map((item, idx) => (idx === i ? { ...item, status: 'success', progress: 100 } : item))
          );
        } catch (fileErr) {
          setUploadsList((prev) =>
            prev.map((item, idx) =>
              idx === i ? { ...item, status: 'error', error: fileErr instanceof Error ? fileErr.message : 'Upload failed' } : item
            )
          );
        }
      }

      // Refresh photo listing
      await loadEventAndPhotos();
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Toggle selection for publishing
  const togglePhotoSelection = (id: string) => {
    if (selectedPhotoIds.includes(id)) {
      setSelectedPhotoIds(selectedPhotoIds.filter((item) => item !== id));
    } else {
      setSelectedPhotoIds([...selectedPhotoIds, id]);
    }
  };

  const selectAllPhotos = () => {
    setSelectedPhotoIds(photos.map((p) => p.id));
  };

  const deselectAllPhotos = () => {
    setSelectedPhotoIds([]);
  };

  // Handle Publish Gallery
  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setPublishing(true);

    try {
      const res = await fetch(`/api/events/${eventId}/gallery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoIds: selectedPhotoIds,
          pin: pinInput.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to publish gallery');
      }

      setPublishResult({
        slug: data.slug,
        pin: data.pin,
        galleryUrl: data.galleryUrl,
      });

      await loadEventAndPhotos();
    } catch (err) {
      alert(`Publishing error: ${err instanceof Error ? err.message : 'Something went wrong'}`);
    } finally {
      setPublishing(false);
    }
  };

  // Handle Delete Photo (Admin Only)
  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm('Are you sure you want to delete this photo?')) return;
    try {
      const res = await fetch(`/api/events/${eventId}/photos?photoId=${photoId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setPhotos(photos.filter((p) => p.id !== photoId));
        setSelectedPhotoIds(selectedPhotoIds.filter((id) => id !== photoId));
      } else {
        const data = await res.json();
        alert(data.error || 'Delete failed');
      }
    } catch (err) {
      alert(`Delete error: ${err instanceof Error ? err.message : 'Something went wrong'}`);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-slate-400 text-sm">
        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mr-3"></div>
        Loading event details...
      </div>
    );
  }

  // Security Scenario #1 Response in UI
  if (forbiddenError) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full p-8 rounded-2xl border border-red-500/30 bg-red-500/10 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m0 0v.01M12 9v2m0-6a9 9 0 110 18 9 9 0 010-18z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-white">403 Forbidden</h2>
          <p className="text-xs text-red-300">{forbiddenError}</p>
          <Link
            href="/dashboard"
            className="inline-block px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!event) return null;

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Link href="/dashboard" className="hover:text-white transition-colors">
          Dashboard
        </Link>
        <span>/</span>
        <span className="text-slate-200 font-medium">{event.name}</span>
      </div>

      {/* Event Header Banner */}
      <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">{event.name}</h1>
            {event.gallery ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Published
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                Draft
              </span>
            )}
          </div>
          {event.description && <p className="text-xs text-slate-400">{event.description}</p>}
          <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
            <span>Created by: <strong className="text-slate-300">{event.createdBy.name}</strong></span>
            <span>•</span>
            <span>Total Photos: <strong className="text-slate-300">{photos.length}</strong></span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {event.gallery && (
            <Link
              href={`/gallery/${event.gallery.slug}`}
              target="_blank"
              className="px-4 py-2.5 rounded-xl border border-pink-500/30 bg-pink-500/10 hover:bg-pink-500/20 text-pink-300 text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              Customer Link ↗
            </Link>
          )}

          {userRole === 'ADMIN' && (
            <button
              onClick={() => {
                setPublishResult(null);
                setShowPublishModal(true);
              }}
              disabled={selectedPhotoIds.length === 0}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-semibold shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Publish Gallery ({selectedPhotoIds.length} Selected)
            </button>
          )}
        </div>
      </div>

      {/* Admin Only: Team Member Assignment Section */}
      {userRole === 'ADMIN' && (
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Assigned Photographers / Team Members
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            {event.members.length === 0 ? (
              <span className="text-xs text-slate-500">No team members assigned yet.</span>
            ) : (
              event.members.map((m) => (
                <div
                  key={m.user.id}
                  className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800/80 text-xs text-slate-200 flex items-center gap-2"
                >
                  <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                  <span>{m.user.name}</span>
                  <span className="text-[10px] text-slate-400">({m.user.email})</span>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleAddMember} className="flex gap-2 max-w-md pt-2">
            <input
              type="email"
              required
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
              placeholder="team member email (e.g. team@trizen.com)"
              className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={addingMember}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {addingMember ? 'Adding...' : 'Assign Member'}
            </button>
          </form>
          {memberMessage && <p className="text-xs text-indigo-400">{memberMessage}</p>}
        </div>
      )}

      {/* Upload Zone (Both Admin & Team) */}
      <div className="p-6 rounded-2xl border-2 border-dashed border-slate-800 hover:border-indigo-500/50 bg-slate-900/30 transition-all text-center space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFilesSelected}
          className="hidden"
          id="photo-upload-input"
        />
        <label
          htmlFor="photo-upload-input"
          className="cursor-pointer inline-flex flex-col items-center justify-center space-y-2"
        >
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-200">
            Click to choose photos or drag and drop
          </p>
          <p className="text-xs text-slate-500">
            Supports multiple high-resolution photos (JPEG, PNG, WebP)
          </p>
        </label>

        {/* Uploads Progress List */}
        {uploadsList.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-800 text-left space-y-2 max-w-xl mx-auto">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Upload Queue ({uploadsList.length} files)</span>
              {isUploading && <span className="text-indigo-400 animate-pulse">Uploading in progress...</span>}
            </div>
            {uploadsList.map((item, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs flex items-center justify-between gap-3"
              >
                <span className="truncate max-w-[200px] text-slate-300 font-mono">{item.filename}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {item.status === 'pending' && <span className="text-slate-500">Queued</span>}
                  {item.status === 'uploading' && <span className="text-indigo-400">Direct S3 Upload...</span>}
                  {item.status === 'confirming' && <span className="text-amber-400">Verifying...</span>}
                  {item.status === 'success' && <span className="text-emerald-400 font-semibold">✓ Uploaded</span>}
                  {item.status === 'error' && (
                    <span className="text-red-400 font-semibold" title={item.error}>
                      ✗ Failed
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Photo Grid Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">
              {userRole === 'ADMIN' ? 'All Uploaded Photos' : 'Your Uploaded Photos'}
            </h2>
            <p className="text-xs text-slate-400">
              {userRole === 'ADMIN'
                ? 'Select the photographs to include in the published client gallery.'
                : 'Showing photographs you contributed to this event.'}
            </p>
          </div>

          {userRole === 'ADMIN' && photos.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={selectAllPhotos}
                className="px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-xs font-medium text-slate-300 transition-colors"
              >
                Select All
              </button>
              <button
                onClick={deselectAllPhotos}
                className="px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-xs font-medium text-slate-300 transition-colors"
              >
                Deselect All
              </button>
            </div>
          )}
        </div>

        {photos.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-slate-800 bg-slate-900/30">
            <p className="text-sm font-semibold text-slate-300">No photos uploaded yet</p>
            <p className="text-xs text-slate-500 mt-1">
              Use the upload zone above to upload event photographs.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {photos.map((photo) => {
              const isSelected = selectedPhotoIds.includes(photo.id);
              return (
                <div
                  key={photo.id}
                  className={`group relative rounded-xl border overflow-hidden transition-all bg-slate-900 ${
                    isSelected
                      ? 'border-indigo-500 ring-2 ring-indigo-500/30'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Image Aspect Box */}
                  <div className="aspect-square bg-slate-950 relative overflow-hidden">
                    <img
                      src={photo.viewUrl}
                      alt={photo.filename}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />

                    {/* Admin Selection Checkbox */}
                    {userRole === 'ADMIN' && (
                      <button
                        type="button"
                        onClick={() => togglePhotoSelection(photo.id)}
                        className={`absolute top-2 left-2 w-6 h-6 rounded-md flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-black/60 text-transparent border border-white/40 hover:border-white'
                        }`}
                      >
                        ✓
                      </button>
                    )}

                    {/* Status Badge */}
                    <div className="absolute top-2 right-2 flex gap-1">
                      {photo.isPublished && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/80 text-white backdrop-blur-sm">
                          Published
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Metadata Bar */}
                  <div className="p-2.5 text-[11px] space-y-1">
                    <p className="font-medium text-slate-200 truncate" title={photo.filename}>
                      {photo.filename}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>{(photo.fileSize / 1024).toFixed(0)} KB</span>
                      <span className="truncate max-w-[80px]">{photo.uploadedBy.name}</span>
                    </div>

                    {/* Admin Delete Action */}
                    {userRole === 'ADMIN' && (
                      <div className="pt-1 border-t border-slate-800/80 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleDeletePhoto(photo.id)}
                          className="text-[10px] text-red-400 hover:text-red-300 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Publish Gallery Modal (Admin Only) */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-2">Publish Customer Gallery</h2>
            <p className="text-xs text-slate-400 mb-4">
              Publish {selectedPhotoIds.length} selected photos for &quot;{event.name}&quot;. Customers can
              access the gallery securely using a PIN without creating an account.
            </p>

            {!publishResult ? (
              <form onSubmit={handlePublish} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Access PIN (6 digits)
                  </label>
                  <input
                    type="text"
                    maxLength={8}
                    pattern="\d{4,8}"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    placeholder="Leave blank to auto-generate (e.g. 482917)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm font-mono focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Only customers entering this PIN will be granted access to view the photos.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPublishModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={publishing}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-semibold shadow-md transition-all disabled:opacity-50"
                  >
                    {publishing ? 'Publishing...' : 'Publish Now'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs">
                  ✓ Gallery published successfully! Share these credentials with your client:
                </div>

                <div className="space-y-2 text-xs font-mono bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-slate-500 block mb-0.5">Gallery URL:</span>
                    <a
                      href={publishResult.galleryUrl}
                      target="_blank"
                      className="text-indigo-400 hover:underline break-all"
                    >
                      {publishResult.galleryUrl}
                    </a>
                  </div>
                  <div className="pt-2 border-t border-slate-800">
                    <span className="text-slate-500 block mb-0.5">Access PIN:</span>
                    <span className="text-xl font-bold text-white tracking-widest">
                      {publishResult.pin}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPublishModal(false)}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
