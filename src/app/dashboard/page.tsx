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
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex items-center gap-3 text-slate-400 text-sm font-medium">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          Loading your workspace...
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner / User Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
            {user.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">{user.name}</h1>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  user.role === 'ADMIN'
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                }`}
              >
                {user.role}
              </span>
            </div>
            <p className="text-xs text-slate-400">{user.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {user.role === 'ADMIN' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              New Event
            </button>
          )}
          <button
            onClick={handleLogout}
            className="px-3.5 py-2 rounded-xl border border-slate-800 hover:bg-slate-800/60 text-slate-300 hover:text-white text-xs font-medium transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Admin Stats Overview */}
      {user.role === 'ADMIN' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40">
            <span className="text-xs text-slate-400 font-medium">Total Events</span>
            <p className="text-2xl font-bold text-white mt-1">{events.length}</p>
          </div>
          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40">
            <span className="text-xs text-slate-400 font-medium">Total Uploaded Photos</span>
            <p className="text-2xl font-bold text-white mt-1">
              {events.reduce((acc, ev) => acc + (ev._count?.photos || 0), 0)}
            </p>
          </div>
          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40">
            <span className="text-xs text-slate-400 font-medium">Published Galleries</span>
            <p className="text-2xl font-bold text-white mt-1">
              {events.filter((ev) => ev.gallery !== null).length}
            </p>
          </div>
        </div>
      )}

      {/* Events List Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">
              {user.role === 'ADMIN' ? 'All Organization Events' : 'Your Assigned Events'}
            </h2>
            <p className="text-xs text-slate-400">
              {user.role === 'ADMIN'
                ? 'Select an event to review photos, add team members, or publish galleries.'
                : 'Select an event to upload and manage your high-resolution photos.'}
            </p>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/20">
            <svg
              className="w-10 h-10 text-slate-600 mx-auto mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-sm font-semibold text-slate-300">No events found</p>
            <p className="text-xs text-slate-500 mt-1">
              {user.role === 'ADMIN'
                ? 'Create your first event using the button above.'
                : 'You have not been assigned to any events yet.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((ev) => (
              <div
                key={ev.id}
                className="flex flex-col justify-between p-6 rounded-2xl border border-slate-800 hover:border-slate-700 bg-slate-900/70 hover:bg-slate-900/90 backdrop-blur-md transition-all group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-bold text-white group-hover:text-indigo-400 transition-colors">
                      {ev.name}
                    </h3>
                    {ev.gallery ? (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                        Published
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
                        Draft
                      </span>
                    )}
                  </div>

                  {ev.description && (
                    <p className="text-xs text-slate-400 line-clamp-2">{ev.description}</p>
                  )}

                  <div className="pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                    <div>
                      <span className="text-slate-500 block">Photos</span>
                      <strong className="text-slate-200">{ev._count?.photos || 0} uploaded</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Team</span>
                      <strong className="text-slate-200">{ev.members?.length || 0} photographers</strong>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  {ev.gallery && (
                    <Link
                      href={`/gallery/${ev.gallery.slug}`}
                      target="_blank"
                      className="text-xs text-pink-400 hover:text-pink-300 flex items-center gap-1 font-medium"
                    >
                      Customer Link ↗
                    </Link>
                  )}
                  <Link
                    href={`/dashboard/events/${ev.id}`}
                    className="ml-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white text-xs font-semibold transition-colors"
                  >
                    {user.role === 'ADMIN' ? 'Manage Event →' : 'Upload Photos →'}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-4">Create New Event</h2>

            {createError && (
              <div className="mb-4 p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Event Name</label>
                <input
                  type="text"
                  required
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="e.g. Rahul & Sneha Sangeet"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Description (Optional)</label>
                <textarea
                  rows={3}
                  value={eventDesc}
                  onChange={(e) => setEventDesc(e.target.value)}
                  placeholder="Ceremony and dinner details..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
