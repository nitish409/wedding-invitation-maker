'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  MusicTrackItem,
  RenderJob,
  SystemSettings,
  TemplateDefinition,
  WeddingProject,
} from '@/types/wedding';
import {
  ShieldCheck,
  Lock,
  Film,
  CheckCircle2,
  XCircle,
  RefreshCw,
  LayoutGrid,
  Music,
  HardDrive,
  Settings,
  Plus,
  Upload,
  Trash2,
  ExternalLink,
  LogOut,
} from 'lucide-react';

interface UsageStats {
  totalProjects: number;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  activeJobs: number;
  storage: {
    photosCount: number;
    photosBytes: number;
    audioCount: number;
    audioBytes: number;
    rendersCount: number;
    rendersBytes: number;
    totalBytes: number;
  };
}

export default function AdminDashboardPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [passcode, setPasscode] = useState('shubhvivah-admin-2026');
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<
    'jobs' | 'templates' | 'music' | 'settings'
  >('jobs');

  const [stats, setStats] = useState<UsageStats | null>(null);
  const [projects, setProjects] = useState<WeddingProject[]>([]);
  const [jobs, setJobs] = useState<RenderJob[]>([]);
  const [templates, setTemplates] = useState<TemplateDefinition[]>([]);
  const [musicTracks, setMusicTracks] = useState<MusicTrackItem[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  // New Template form state
  const [newTplName, setNewTplName] = useState('');
  const [newTplHindi, setNewTplHindi] = useState('');
  const [newTplSubtitle, setNewTplSubtitle] = useState('');
  const [newTplBg, setNewTplBg] = useState('#3B0510');
  const [newTplGold, setNewTplGold] = useState('#D4AF37');

  // New Approved Music form state
  const [newMusicTitle, setNewMusicTitle] = useState('');
  const [newMusicCategory, setNewMusicCategory] = useState('Royal & Festive');
  const [uploadingMusic, setUploadingMusic] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const fetchAdminData = useCallback(async (overridePass?: string) => {
    try {
      const res = await fetch('/api/admin', {
        headers: overridePass ? { 'x-admin-passcode': overridePass } : {},
        cache: 'no-store',
      });
      if (res.status === 401) {
        setAuthenticated(false);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setAuthenticated(true);
      setStats(data.stats);
      setProjects(data.projects || []);
      setJobs(data.jobs || []);
      setTemplates(data.templates || []);
      setMusicTracks(data.musicTracks || []);
      setSettings(data.settings || null);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAdminData();
  }, [fetchAdminData]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', passcode }),
    });
    const data = await res.json();
    if (!res.ok) {
      setAuthError(data.error || 'Invalid admin passcode');
      return;
    }
    await fetchAdminData(passcode);
  };

  const handleLogout = async () => {
    await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });
    setAuthenticated(false);
  };

  const postAdminAction = async (payload: Record<string, unknown>) => {
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-passcode': passcode,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      await fetchAdminData(passcode);
    }
    return data;
  };

  const handleUploadApprovedMusic = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMusic(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', 'audio');
      const upRes = await fetch('/api/upload', { method: 'POST', body: fd });
      const upData = await upRes.json();
      if (!upRes.ok) throw new Error(upData.error || 'Upload failed');

      await postAdminAction({
        action: 'addMusicTrack',
        title: newMusicTitle.trim() || upData.title || file.name,
        category: newMusicCategory,
        url: upData.url,
        durationSec: 60,
      });
      setNewMusicTitle('');
      setStatusBanner('Approved background music track added to library!');
    } catch (err: unknown) {
      setStatusBanner(
        err instanceof Error ? err.message : 'Failed to upload music'
      );
    } finally {
      setUploadingMusic(false);
      e.target.value = '';
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0.00 MB';
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  if (loading) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center bg-[#FDF6EC] text-[#5C0A1B] font-semibold">
        Loading Admin Control Center...
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center bg-[#FDF6EC] px-4 py-12">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-md bg-white rounded-3xl p-8 border-ornate space-y-5"
        >
          <div className="w-14 h-14 rounded-2xl bg-[#5C0A1B] text-[#D4AF37] flex items-center justify-center mx-auto shadow-md">
            <Lock className="w-7 h-7" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold font-royal text-[#5C0A1B]">
              ShubhVivah Admin Portal
            </h1>
            <p className="text-xs text-[#5C0A1B]/70 mt-1">
              Enter the administrator passcode to manage templates, music,
              storage, and rendering jobs.
            </p>
          </div>

          {authError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium text-center">
              {authError}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[#5C0A1B] mb-1">
              Admin Passcode
            </label>
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-[#D4AF37]/50 text-sm focus:outline-none focus:ring-2 focus:ring-[#5C0A1B]"
            />
            <p className="text-[11px] text-[#5C0A1B]/60 mt-1.5">
              Default local passcode:{' '}
              <code className="font-mono bg-amber-50 px-1.5 py-0.5 rounded">
                shubhvivah-admin-2026
              </code>
            </p>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-[#5C0A1B] hover:bg-[#82142B] text-[#FFFDF9] font-bold text-sm transition shadow-md"
          >
            Sign In to Admin Dashboard
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDF6EC] py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Top Bar */}
        <div className="bg-white rounded-3xl p-6 border-ornate flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#5C0A1B] text-[#D4AF37] flex items-center justify-center shadow-md">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold font-royal text-[#5C0A1B]">
                Admin Dashboard &amp; Render Queue Monitor
              </h1>
              <p className="text-xs text-[#5C0A1B]/70">
                Monitor MP4 rendering jobs, manage templates &amp; music, and
                inspect storage usage.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void fetchAdminData(passcode)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-[#5C0A1B] border border-[#D4AF37]/50 text-xs font-semibold"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>

        {statusBanner && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold flex items-center justify-between">
            <span>{statusBanner}</span>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Metrics Summary Cards */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-[#D4AF37]/40 shadow-sm">
              <div className="text-xs font-semibold text-[#5C0A1B]/70 flex items-center justify-between">
                <span>Total Projects</span>
                <Film className="w-4 h-4 text-[#D4AF37]" />
              </div>
              <div className="text-3xl font-bold text-[#5C0A1B] mt-2">
                {stats.totalProjects}
              </div>
              <div className="text-[11px] text-[#5C0A1B]/65 mt-1">
                {stats.totalJobs} total render jobs
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#D4AF37]/40 shadow-sm">
              <div className="text-xs font-semibold text-emerald-800 flex items-center justify-between">
                <span>Successful Renders</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-3xl font-bold text-emerald-700 mt-2">
                {stats.completedJobs}
              </div>
              <div className="text-[11px] text-[#5C0A1B]/65 mt-1">
                {stats.activeJobs} currently active in queue
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#D4AF37]/40 shadow-sm">
              <div className="text-xs font-semibold text-red-800 flex items-center justify-between">
                <span>Failed Renders</span>
                <XCircle className="w-4 h-4 text-red-600" />
              </div>
              <div className="text-3xl font-bold text-red-600 mt-2">
                {stats.failedJobs}
              </div>
              <div className="text-[11px] text-[#5C0A1B]/65 mt-1">
                Retryable from jobs table
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#D4AF37]/40 shadow-sm">
              <div className="text-xs font-semibold text-[#5C0A1B]/70 flex items-center justify-between">
                <span>Storage Usage</span>
                <HardDrive className="w-4 h-4 text-[#D4AF37]" />
              </div>
              <div className="text-3xl font-bold text-[#5C0A1B] mt-2">
                {formatBytes(stats.storage.totalBytes)}
              </div>
              <div className="text-[11px] text-[#5C0A1B]/65 mt-1">
                {stats.storage.rendersCount} MP4s • {stats.storage.photosCount}{' '}
                Photos
              </div>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: 'jobs', label: 'Projects & Render Jobs', icon: Film },
              { id: 'templates', label: 'Video Templates', icon: LayoutGrid },
              { id: 'music', label: 'Approved Music', icon: Music },
              {
                id: 'settings',
                label: 'Storage & Output Settings',
                icon: Settings,
              },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition border ${
                  activeTab === t.id
                    ? 'bg-[#5C0A1B] text-[#FFFDF9] border-[#D4AF37] shadow-sm'
                    : 'bg-white text-[#5C0A1B] border-[#D4AF37]/40 hover:bg-amber-50'
                }`}
              >
                <Icon className="w-4 h-4 text-[#D4AF37]" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: PROJECTS & RENDER JOBS */}
        {activeTab === 'jobs' && (
          <div className="bg-white rounded-3xl p-6 border-ornate space-y-4">
            <h2 className="text-xl font-bold font-royal text-[#5C0A1B]">
              Generated Projects &amp; Rendering Jobs ({jobs.length})
            </h2>

            {jobs.length === 0 ? (
              <p className="text-sm text-[#5C0A1B]/70 py-8 text-center">
                No rendering jobs yet. Create a wedding invitation to see jobs
                here.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#D4AF37]/40 text-[#5C0A1B]/70 uppercase">
                      <th className="py-3 px-2">Couple / Project</th>
                      <th className="py-3 px-2">Template</th>
                      <th className="py-3 px-2">Status</th>
                      <th className="py-3 px-2">Progress / Spec</th>
                      <th className="py-3 px-2">Size</th>
                      <th className="py-3 px-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {jobs.map((j) => {
                      const proj = projects.find((p) => p.id === j.projectId);
                      return (
                        <tr key={j.id} className="hover:bg-amber-50/40">
                          <td className="py-3 px-2 font-semibold text-[#5C0A1B]">
                            {proj
                              ? `${proj.brideName} & ${proj.groomName}`
                              : j.projectId.slice(0, 8)}
                            <div className="text-[10px] text-[#5C0A1B]/60 font-normal">
                              Job {j.id.slice(0, 8)} • Attempt #{j.attempts}
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            {proj?.templateId || 'royal-wedding'}
                          </td>
                          <td className="py-3 px-2">
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                                j.status === 'completed'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : j.status === 'failed'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {j.status}
                            </span>
                            {j.errorMessage && (
                              <div className="text-[10px] text-red-600 mt-1 max-w-xs truncate">
                                {j.errorMessage}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-2">
                            <div className="font-semibold">{j.progress}%</div>
                            <div className="text-[10px] text-[#5C0A1B]/60">
                              {j.resolution} • {j.fps} FPS
                              {j.durationSec ? ` • ${j.durationSec}s` : ''}
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            {j.outputSizeBytes
                              ? formatBytes(j.outputSizeBytes)
                              : '—'}
                          </td>
                          <td className="py-3 px-2 text-right space-x-2">
                            <Link
                              href={`/project/${j.projectId}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 border border-[#D4AF37]/50 text-[#5C0A1B] font-semibold"
                            >
                              <span>View</span>
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                            <button
                              type="button"
                              onClick={() =>
                                void postAdminAction({
                                  action: 'retryJob',
                                  jobId: j.id,
                                })
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#5C0A1B] text-[#FFFDF9] font-semibold"
                            >
                              <RefreshCw className="w-3 h-3" />
                              Retry
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: VIDEO TEMPLATES MANAGEMENT */}
        {activeTab === 'templates' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white rounded-3xl p-6 border-ornate space-y-4">
              <h2 className="text-xl font-bold font-royal text-[#5C0A1B]">
                Manage Video Templates ({templates.length})
              </h2>
              <div className="space-y-3">
                {templates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="p-4 rounded-2xl bg-[#FDF6EC] border border-[#D4AF37]/40 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl border border-[#D4AF37]"
                        style={{ backgroundColor: tpl.bgColor }}
                      />
                      <div>
                        <div className="font-bold text-sm text-[#5C0A1B]">
                          {tpl.name} ({tpl.nameHindi})
                        </div>
                        <div className="text-xs text-[#5C0A1B]/70">
                          {tpl.subtitle}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        void postAdminAction({
                          action: 'toggleTemplate',
                          templateId: tpl.id,
                          enabled: !tpl.enabled,
                        })
                      }
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                        tpl.enabled
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : 'bg-stone-200 text-stone-700'
                      }`}
                    >
                      {tpl.enabled ? 'Enabled (Active)' : 'Disabled'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 bg-white rounded-3xl p-6 border-ornate space-y-4">
              <h3 className="text-lg font-bold font-royal text-[#5C0A1B]">
                Add New Template Preset
              </h3>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-[#5C0A1B] mb-1">
                    Template Name (English)
                  </label>
                  <input
                    type="text"
                    value={newTplName}
                    onChange={(e) => setNewTplName(e.target.value)}
                    placeholder="e.g. Udaipur Sunset Palace"
                    className="w-full px-3 py-2 rounded-xl border border-[#D4AF37]/50"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#5C0A1B] mb-1">
                    Hindi Title
                  </label>
                  <input
                    type="text"
                    value={newTplHindi}
                    onChange={(e) => setNewTplHindi(e.target.value)}
                    placeholder="उदयपुर शाही विवाह"
                    className="w-full px-3 py-2 rounded-xl border border-[#D4AF37]/50"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#5C0A1B] mb-1">
                    Subtitle
                  </label>
                  <input
                    type="text"
                    value={newTplSubtitle}
                    onChange={(e) => setNewTplSubtitle(e.target.value)}
                    placeholder="Crimson & Royal Gold"
                    className="w-full px-3 py-2 rounded-xl border border-[#D4AF37]/50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-[#5C0A1B] mb-1">
                      Background Color
                    </label>
                    <input
                      type="color"
                      value={newTplBg}
                      onChange={(e) => setNewTplBg(e.target.value)}
                      className="w-full h-9 rounded-lg cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[#5C0A1B] mb-1">
                      Accent Gold Color
                    </label>
                    <input
                      type="color"
                      value={newTplGold}
                      onChange={(e) => setNewTplGold(e.target.value)}
                      className="w-full h-9 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (!newTplName.trim()) return;
                    await postAdminAction({
                      action: 'addTemplate',
                      name: newTplName.trim(),
                      nameHindi: newTplHindi.trim() || 'शाही विवाह',
                      subtitle: newTplSubtitle.trim() || 'Royal Custom Theme',
                      bgColor: newTplBg,
                      secondaryColor: newTplGold,
                    });
                    setNewTplName('');
                    setNewTplHindi('');
                    setNewTplSubtitle('');
                    setStatusBanner('New video template added!');
                  }}
                  className="w-full py-2.5 rounded-xl bg-[#5C0A1B] text-[#FFFDF9] font-bold flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4 text-[#D4AF37]" />
                  Add Template to Gallery
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: APPROVED BACKGROUND MUSIC */}
        {activeTab === 'music' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white rounded-3xl p-6 border-ornate space-y-4">
              <h2 className="text-xl font-bold font-royal text-[#5C0A1B]">
                Approved Background Music Library ({musicTracks.length})
              </h2>
              <div className="space-y-3">
                {musicTracks.map((track) => (
                  <div
                    key={track.id}
                    className="p-4 rounded-2xl bg-[#FDF6EC] border border-[#D4AF37]/40 flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="font-bold text-sm text-[#5C0A1B]">
                        {track.title}
                      </div>
                      <div className="text-xs text-[#5C0A1B]/70">
                        {track.category} • {track.artist}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void postAdminAction({
                          action: 'toggleMusicTrack',
                          trackId: track.id,
                          enabled: !track.enabled,
                        })
                      }
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                        track.enabled
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : 'bg-stone-200 text-stone-700'
                      }`}
                    >
                      {track.enabled ? 'Approved' : 'Disabled'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 bg-white rounded-3xl p-6 border-ornate space-y-4">
              <h3 className="text-lg font-bold font-royal text-[#5C0A1B]">
                Upload Approved Royalty-Free Music
              </h3>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-[#5C0A1B] mb-1">
                    Track Title
                  </label>
                  <input
                    type="text"
                    value={newMusicTitle}
                    onChange={(e) => setNewMusicTitle(e.target.value)}
                    placeholder="e.g. Royal Jaisalmer Santoor"
                    className="w-full px-3 py-2 rounded-xl border border-[#D4AF37]/50"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#5C0A1B] mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={newMusicCategory}
                    onChange={(e) => setNewMusicCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D4AF37]/50"
                  />
                </div>
                <label className="cursor-pointer w-full py-3 rounded-xl bg-[#5C0A1B] text-[#FFFDF9] font-bold flex items-center justify-center gap-2">
                  <Upload className="w-4 h-4 text-[#D4AF37]" />
                  <span>
                    {uploadingMusic
                      ? 'Uploading & Registering...'
                      : 'Select MP3 / WAV & Add to Library'}
                  </span>
                  <input
                    type="file"
                    accept="audio/mpeg,audio/mp3,audio/wav,.mp3,.wav"
                    onChange={handleUploadApprovedMusic}
                    disabled={uploadingMusic}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: STORAGE & DEFAULT OUTPUT SETTINGS */}
        {activeTab === 'settings' && settings && stats && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 bg-white rounded-3xl p-6 border-ornate space-y-4">
              <h2 className="text-xl font-bold font-royal text-[#5C0A1B]">
                Default Video Output &amp; Security Settings
              </h2>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-[#5C0A1B] mb-1">
                    Output Width (px)
                  </label>
                  <input
                    type="number"
                    value={settings.resolutionWidth}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        resolutionWidth: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#D4AF37]/50"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#5C0A1B] mb-1">
                    Output Height (px)
                  </label>
                  <input
                    type="number"
                    value={settings.resolutionHeight}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        resolutionHeight: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#D4AF37]/50"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#5C0A1B] mb-1">
                    Frame Rate (FPS)
                  </label>
                  <input
                    type="number"
                    value={settings.fps}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        fps: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#D4AF37]/50"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#5C0A1B] mb-1">
                    Download Link Expiry (Hours)
                  </label>
                  <input
                    type="number"
                    value={settings.linkExpiryHours}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        linkExpiryHours: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#D4AF37]/50"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#5C0A1B] mb-1">
                    Temp File Auto-Delete (Hours)
                  </label>
                  <input
                    type="number"
                    value={settings.autoDeleteTempHours}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        autoDeleteTempHours: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#D4AF37]/50"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#5C0A1B] mb-1">
                    Max Renders / IP / Hour
                  </label>
                  <input
                    type="number"
                    value={settings.maxRendersPerIpHour}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        maxRendersPerIpHour: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#D4AF37]/50"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={async () => {
                  await postAdminAction({
                    action: 'updateSettings',
                    ...settings,
                  });
                  setStatusBanner('System output settings updated!');
                }}
                className="w-full py-3 rounded-xl bg-[#5C0A1B] text-[#FFFDF9] font-bold text-xs"
              >
                Save Default Output Settings
              </button>
            </div>

            <div className="lg:col-span-6 bg-white rounded-3xl p-6 border-ornate space-y-4">
              <h2 className="text-xl font-bold font-royal text-[#5C0A1B]">
                Private Storage Breakdown &amp; Cleanup
              </h2>
              <div className="space-y-2.5 text-xs">
                <div className="p-3.5 rounded-xl bg-[#FDF6EC] flex justify-between">
                  <span>Private Uploaded Photos ({stats.storage.photosCount} files)</span>
                  <span className="font-bold">
                    {formatBytes(stats.storage.photosBytes)}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#FDF6EC] flex justify-between">
                  <span>Custom Uploaded Audio ({stats.storage.audioCount} files)</span>
                  <span className="font-bold">
                    {formatBytes(stats.storage.audioBytes)}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#FDF6EC] flex justify-between">
                  <span>Rendered HD MP4 Videos ({stats.storage.rendersCount} files)</span>
                  <span className="font-bold">
                    {formatBytes(stats.storage.rendersBytes)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={async () => {
                  const res = await postAdminAction({
                    action: 'cleanupStorage',
                  });
                  setStatusBanner(
                    `Storage cleanup finished (${res.deletedFiles || 0} expired/temporary files removed).`
                  );
                }}
                className="w-full py-3 rounded-xl bg-amber-100 hover:bg-amber-200 text-[#5C0A1B] border border-[#D4AF37] font-bold text-xs flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Run Expired File &amp; Temp Storage Cleanup Now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
