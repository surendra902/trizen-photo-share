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
      <div className="flex-1 flex items-center justify-center p-8 text-muted text-sm">
        <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin mr-3"></div>
        Loading event details…
      </div>
    );
  }

  // Security Scenario #1 Response in UI
  if (forbiddenError) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full card border-red-500/40 p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full border border-red-500/40 bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m0 0v.01M12 9v2m0-6a9 9 0 110 18 9 9 0 010-18z" />
            </svg>
          </div>
          <h2 className="font-display text-2xl">403 — Forbidden</h2>
          <p className="text-sm text-red-300">{forbiddenError}</p>
          <Link href="/dashboard" className="btn btn-ghost !py-2.5 text-sm inline-flex">
            Return to dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!event) return null;

  return (
    <div className="flex-1 max-w-6xl w-full mx-auto px-5 sm:px-8 py-10 space-y-10">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center gap-2 text-xs font-mono text-faint">
        <Link href="/dashboard" className="hover:text-paper transition-colors">
          dashboard
        </Link>
        <span className="text-line">/</span>
        <span className="text-muted">{event.name}</span>
      </div>

      {/* Event Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-line-soft pb-8">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-4xl tracking-tight">{event.name}</h1>
            <span className={`eyebrow ${event.gallery ? 'text-accent' : 'text-faint'}`}>
              {event.gallery ? '● Live' : '○ Draft'}
            </span>
          </div>
          {event.description && <p className="text-muted leading-relaxed">{event.description}</p>}
          <div className="flex items-center gap-4 text-xs font-mono text-faint pt-1">
            <span>
              by <span className="text-muted">{event.createdBy.name}</span>
            </span>
            <span className="text-line">/</span>
            <span>
              <span className="text-muted">{photos.length}</span> photos
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {event.gallery && (
            <Link
              href={`/gallery/${event.gallery.slug}`}
              target="_blank"
              className="btn btn-ghost !py-2.5 text-sm"
            >
              Customer link ↗
            </Link>
          )}

          {userRole === 'ADMIN' && (
            <button
              onClick={() => {
                setPublishResult(null);
                setShowPublishModal(true);
              }}
              disabled={selectedPhotoIds.length === 0}
              className="btn btn-primary !py-2.5 text-sm"
            >
              Publish gallery ({selectedPhotoIds.length})
            </button>
          )}
        </div>
      </div>

      {/* Admin Only: Team Member Assignment Section */}
      {userRole === 'ADMIN' && (
        <div className="card p-6 space-y-4">
          <p className="eyebrow">Assigned photographers</p>

          <div className="flex flex-wrap items-center gap-2">
            {event.members.length === 0 ? (
              <span className="text-sm text-faint">No team members assigned yet.</span>
            ) : (
              event.members.map((m) => (
                <div
                  key={m.user.id}
                  className="px-3 py-1.5 rounded-full border border-line bg-ink-sunken text-xs flex items-center gap-2"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
                  <span className="text-paper">{m.user.name}</span>
                  <span className="text-faint font-mono">{m.user.email}</span>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleAddMember} className="flex gap-2 max-w-md pt-1">
            <input
              type="email"
              required
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
              placeholder="team@trizen.com"
              className="field flex-1 !py-2.5"
            />
            <button type="submit" disabled={addingMember} className="btn btn-ghost !py-2.5 text-sm shrink-0">
              {addingMember ? 'Adding…' : 'Assign'}
            </button>
          </form>
          {memberMessage && <p className="text-xs text-accent font-mono">{memberMessage}</p>}
        </div>
      )}

      {/* Upload Zone (Both Admin & Team) */}
      <div className="p-8 rounded-xl border border-dashed border-line hover:border-accent/60 bg-ink-raised/40 transition-all text-center space-y-4">
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
          className="cursor-pointer inline-flex flex-col items-center justify-center space-y-3"
        >
          <div className="w-12 h-12 rounded-full border border-line bg-ink-sunken text-accent flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="font-display text-lg">Add photographs</p>
          <p className="text-xs text-faint font-mono">
            Click to choose — multiple high-res files (JPEG, PNG, WebP)
          </p>
        </label>

        {/* Uploads Progress List */}
        {uploadsList.length > 0 && (
          <div className="mt-4 pt-4 border-t border-line-soft text-left space-y-2 max-w-xl mx-auto">
            <div className="flex items-center justify-between eyebrow mb-1">
              <span>Upload queue ({uploadsList.length})</span>
              {isUploading && <span className="text-accent">uploading…</span>}
            </div>
            {uploadsList.map((item, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-lg bg-ink-sunken border border-line text-xs flex items-center justify-between gap-3 font-mono"
              >
                <span className="truncate max-w-[200px] text-muted">{item.filename}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {item.status === 'pending' && <span className="text-faint">queued</span>}
                  {item.status === 'uploading' && <span className="text-accent">→ storage</span>}
                  {item.status === 'confirming' && <span className="text-accent-soft">verifying</span>}
                  {item.status === 'success' && <span className="text-emerald-400">✓ done</span>}
                  {item.status === 'error' && (
                    <span className="text-red-400" title={item.error}>
                      ✗ failed
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Photo Grid Section */}
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-line-soft pb-4">
          <div>
            <h2 className="font-display text-2xl tracking-tight">
              {userRole === 'ADMIN' ? 'All uploaded photos.' : 'Your uploaded photos.'}
            </h2>
            <p className="text-sm text-muted mt-1">
              {userRole === 'ADMIN'
                ? 'Select the photographs to include in the published client gallery.'
                : 'Showing photographs you contributed to this event.'}
            </p>
          </div>

          {userRole === 'ADMIN' && photos.length > 0 && (
            <div className="flex items-center gap-2">
              <button onClick={selectAllPhotos} className="btn btn-ghost !py-2 !px-4 text-xs">
                Select all
              </button>
              <button onClick={deselectAllPhotos} className="btn btn-ghost !py-2 !px-4 text-xs">
                Clear
              </button>
            </div>
          )}
        </div>

        {photos.length === 0 ? (
          <div className="p-16 text-center rounded-xl border border-line">
            <p className="font-display text-xl">No photos uploaded yet</p>
            <p className="text-sm text-muted mt-2">Use the upload zone above to add event photographs.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {photos.map((photo) => {
              const isSelected = selectedPhotoIds.includes(photo.id);
              return (
                <div
                  key={photo.id}
                  className={`group relative rounded-lg border overflow-hidden transition-all bg-ink-raised ${
                    isSelected ? 'border-accent ring-2 ring-accent/30' : 'border-line hover:border-line'
                  }`}
                >
                  {/* Image Aspect Box */}
                  <div className="aspect-square bg-ink-sunken relative overflow-hidden">
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
                            ? 'bg-accent text-ink shadow-md'
                            : 'bg-black/60 text-transparent border border-white/40 hover:border-white'
                        }`}
                        aria-label="Select photo"
                      >
                        ✓
                      </button>
                    )}

                    {/* Status Badge */}
                    <div className="absolute top-2 right-2 flex gap-1">
                      {photo.isPublished && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-accent/90 text-ink backdrop-blur-sm">
                          Live
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Metadata Bar */}
                  <div className="p-2.5 text-[11px] space-y-1">
                    <p className="text-paper truncate font-mono" title={photo.filename}>
                      {photo.filename}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-faint font-mono">
                      <span>{(photo.fileSize / 1024).toFixed(0)} KB</span>
                      <span className="truncate max-w-[80px]">{photo.uploadedBy.name}</span>
                    </div>

                    {/* Admin Delete Action */}
                    {userRole === 'ADMIN' && (
                      <div className="pt-1 border-t border-line-soft flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleDeletePhoto(photo.id)}
                          className="text-[10px] text-faint hover:text-red-400 transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm">
          <div className="w-full max-w-md card p-7 shadow-2xl">
            <p className="eyebrow mb-2">Publish</p>
            <h2 className="font-display text-2xl tracking-tight mb-2">Customer gallery.</h2>
            <p className="text-sm text-muted mb-5">
              Publish {selectedPhotoIds.length} selected photos for &quot;{event.name}&quot;. Customers
              access the gallery with a PIN — no account required.
            </p>

            {!publishResult ? (
              <form onSubmit={handlePublish} className="space-y-4">
                <div>
                  <label className="eyebrow block mb-2">Access PIN</label>
                  <input
                    type="text"
                    maxLength={8}
                    pattern="\d{4,8}"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    placeholder="Leave blank to auto-generate"
                    className="field font-mono"
                  />
                  <p className="text-xs text-faint mt-1.5">
                    Only customers entering this PIN can view the photos.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPublishModal(false)}
                    className="btn btn-ghost !py-2.5 text-sm"
                  >
                    Cancel
                  </button>
                  <button type="submit" disabled={publishing} className="btn btn-primary !py-2.5 text-sm">
                    {publishing ? 'Publishing…' : 'Publish now'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="p-3.5 rounded-lg border border-accent/40 bg-accent-dim/40 text-accent-soft text-sm">
                  ✓ Gallery published. Share these credentials with your client:
                </div>

                <div className="space-y-3 font-mono text-xs bg-ink-sunken p-4 rounded-lg border border-line">
                  <div>
                    <span className="text-faint block mb-1">gallery url</span>
                    <a
                      href={publishResult.galleryUrl}
                      target="_blank"
                      className="link-underline text-accent break-all"
                    >
                      {publishResult.galleryUrl}
                    </a>
                  </div>
                  <div className="pt-3 border-t border-line">
                    <span className="text-faint block mb-1">access pin</span>
                    <span className="font-display text-2xl text-paper tracking-widest">
                      {publishResult.pin}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPublishModal(false)}
                  className="btn btn-ghost w-full !py-2.5 text-sm"
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
