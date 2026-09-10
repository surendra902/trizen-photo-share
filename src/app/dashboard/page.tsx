'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'TEAM';
}

interface EventItem {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  createdBy: { name: string; email: string };
  members: Array<{ user: { id: string; name: string; email: string } }>;
  gallery: { id: string; slug: string; publishedAt: string } | null;
  _count: { photos: number };
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [eventName, setEventName] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const loadData = async () => {
    try {
      // 1. Fetch user
      const meRes = await fetch('/api/auth/me');
      if (!meRes.ok) {
        router.push('/login');
        return;
      }
      const meData = await meRes.json();
      setUser(meData.user);

      // 2. Fetch scoped events
      const eventsRes = await fetch('/api/events');
      if (eventsRes.ok) {
        const data = await eventsRes.json();
        setEvents(data.events || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setCreating(true);

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: eventName, description: eventDesc }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create event');
      }

      setEventName('');
      setEventDesc('');
      setShowCreateModal(false);
      loadData();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex items-center gap-3 text-muted text-sm">
          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
          Loading your workspace…
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex-1 max-w-6xl w-full mx-auto px-5 sm:px-8 py-12 space-y-12">
      {/* Top Banner / User Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full border border-line bg-ink-raised flex items-center justify-center font-display text-xl text-accent">
            {user.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-2xl tracking-tight">{user.name}</h1>
              <span className="eyebrow text-accent border border-line rounded-full px-2.5 py-1">
                {user.role}
              </span>
            </div>
            <p className="text-sm text-muted font-mono mt-0.5">{user.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {user.role === 'ADMIN' && (
            <button onClick={() => setShowCreateModal(true)} className="btn btn-primary !py-2.5 text-sm">
              + New Event
            </button>
          )}
          <button onClick={handleLogout} className="btn btn-ghost !py-2.5 text-sm">
            Sign out
          </button>
        </div>
      </div>

      {/* Admin Stats Overview */}
      {user.role === 'ADMIN' && (
        <div className="grid grid-cols-3 gap-px bg-line rounded-xl overflow-hidden border border-line">
          {[
            { label: 'Events', value: events.length },
            {
              label: 'Photos uploaded',
              value: events.reduce((acc, ev) => acc + (ev._count?.photos || 0), 0),
            },
            { label: 'Galleries published', value: events.filter((ev) => ev.gallery !== null).length },
          ].map((stat) => (
            <div key={stat.label} className="bg-ink-raised p-5 sm:p-6">
              <span className="eyebrow">{stat.label}</span>
              <p className="font-display text-4xl mt-2">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Events List Section */}
      <div className="space-y-6">
        <div className="flex items-baseline gap-4 border-b border-line-soft pb-4">
          <span className="eyebrow text-accent">01</span>
          <div>
            <h2 className="font-display text-2xl tracking-tight">
              {user.role === 'ADMIN' ? 'All events.' : 'Your assigned events.'}
            </h2>
            <p className="text-sm text-muted mt-1">
              {user.role === 'ADMIN'
                ? 'Select an event to review photos, add team members, or publish a gallery.'
                : 'Select an event to upload and manage your high-resolution photos.'}
            </p>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="p-16 text-center rounded-xl border border-dashed border-line">
            <p className="font-display text-xl">No events yet</p>
            <p className="text-sm text-muted mt-2">
              {user.role === 'ADMIN'
                ? 'Create your first event using the button above.'
                : 'You have not been assigned to any events yet.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {events.map((ev) => (
              <div
                key={ev.id}
                className="flex flex-col justify-between card p-6 hover:border-accent/50 transition-colors group"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display text-xl leading-tight group-hover:text-accent transition-colors">
                      {ev.name}
                    </h3>
                    <span
                      className={`eyebrow shrink-0 mt-1 ${ev.gallery ? 'text-accent' : 'text-faint'}`}
                    >
                      {ev.gallery ? '● Live' : '○ Draft'}
                    </span>
                  </div>

                  {ev.description && (
                    <p className="text-sm text-muted line-clamp-2 leading-relaxed">{ev.description}</p>
                  )}

                  <div className="pt-4 border-t border-line-soft grid grid-cols-2 gap-2 font-mono text-xs">
                    <div>
                      <span className="text-faint block">photos</span>
                      <span className="text-paper">{ev._count?.photos || 0}</span>
                    </div>
                    <div>
                      <span className="text-faint block">team</span>
                      <span className="text-paper">{ev.members?.length || 0}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-line-soft flex items-center justify-between gap-2">
                  {ev.gallery && (
                    <Link
                      href={`/gallery/${ev.gallery.slug}`}
                      target="_blank"
                      className="link-underline text-xs text-muted hover:text-accent font-medium"
                    >
                      Customer link ↗
                    </Link>
                  )}
                  <Link
                    href={`/dashboard/events/${ev.id}`}
                    className="link-underline ml-auto text-sm text-accent font-medium"
                  >
                    {user.role === 'ADMIN' ? 'Manage →' : 'Upload →'}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm">
          <div className="w-full max-w-md card p-7 shadow-2xl">
            <p className="eyebrow mb-2">New event</p>
            <h2 className="font-display text-2xl tracking-tight mb-5">Create event.</h2>

            {createError && (
              <div className="mb-4 p-3 rounded-lg border border-red-500/40 bg-red-500/10 text-red-300 text-sm">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="eyebrow block mb-2">Event name</label>
                <input
                  type="text"
                  required
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="e.g. Rahul & Sneha Sangeet"
                  className="field"
                />
              </div>

              <div>
                <label className="eyebrow block mb-2">Description (optional)</label>
                <textarea
                  rows={3}
                  value={eventDesc}
                  onChange={(e) => setEventDesc(e.target.value)}
                  placeholder="Ceremony and dinner details…"
                  className="field resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-ghost !py-2.5 text-sm"
                >
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="btn btn-primary !py-2.5 text-sm">
                  {creating ? 'Creating…' : 'Create event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
