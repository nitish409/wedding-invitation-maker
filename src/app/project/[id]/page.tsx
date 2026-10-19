'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { RenderJob, WeddingProject } from '@/types/wedding';
import { formatReadableDate } from '@/lib/video/sceneCalculator';
import {
  Download,
  Share2,
  Copy,
  Check,
  Edit3,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  Loader2,
  Lock,
  Globe,
  MapPin,
  Calendar,
  Music,
  Film,
} from 'lucide-react';

export default function ProjectStatusAndDownloadPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params.id;

  const [project, setProject] = useState<WeddingProject | null>(null);
  const [job, setJob] = useState<RenderJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [localBlobUrl, setLocalBlobUrl] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const recoveringVideoRef = useRef(false);

  const fetchStatus = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Project not found');
      }
      setProject(data.project);
      setJob(data.job);
      setLoading(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load project');
      setLoading(false);
    } finally {
      inFlightRef.current = false;
    }
  }, [projectId]);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  // Poll job status while queued or processing
  useEffect(() => {
    if (!job || (job.status !== 'queued' && job.status !== 'processing')) {
      return;
    }
    const timer = setInterval(() => {
      void fetchStatus();
    }, 1500);
    return () => clearInterval(timer);
  }, [job, fetchStatus]);

  // Use same-route /api/projects/[id]?stream=1 so Vercel routes to the exact same warm Lambda container
  const videoStreamUrl =
    localBlobUrl ||
    (project && job && job.status === 'completed'
      ? `/api/projects/${project.id}?stream=1&jobId=${encodeURIComponent(
          job.id
        )}&token=${encodeURIComponent(job.downloadToken || '')}`
      : project?.renderedVideoUrl || '');

  const handleVideoPlayerError = async () => {
    if (!project || localBlobUrl || recoveringVideoRef.current) return;
    recoveringVideoRef.current = true;
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'download-mp4', project }),
      });
      if (res.ok) {
        const blob = await res.blob();
        if (blob.size > 1000) {
          setLocalBlobUrl(URL.createObjectURL(blob));
          setDownloadError(null);
        }
      }
    } catch {
      // ignore background recovery error
    } finally {
      recoveringVideoRef.current = false;
    }
  };

  const handleDownloadMp4 = async () => {
    if (!project) return;
    setDownloadError(null);
    setDownloading(true);
    setDownloadProgress(10);

    try {
      const triggerBrowserDownload = (blobUrlToSave: string) => {
        const a = document.createElement('a');
        a.href = blobUrlToSave;
        a.download = `${project.brideName.replace(
          /\s+/g,
          '_'
        )}_Weds_${project.groomName.replace(/\s+/g, '_')}_Invitation.mp4`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      };

      if (localBlobUrl) {
        setDownloadProgress(100);
        triggerBrowserDownload(localBlobUrl);
        return;
      }

      const primaryUrl = `/api/projects/${project.id}?download=1&jobId=${encodeURIComponent(
        job?.id || ''
      )}&token=${encodeURIComponent(job?.downloadToken || '')}`;

      let res = await fetch(primaryUrl);
      // If a cold serverless container spun up without the MP4 in /tmp, POST the project to render & stream directly
      if (!res.ok) {
        setDownloadProgress(25);
        res = await fetch(`/api/projects/${project.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'download-mp4', project }),
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          errData.error ||
            'Failed to download MP4 video. Please try regenerating.'
        );
      }

      const contentLength = Number(res.headers.get('Content-Length')) || 0;
      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error('Browser stream reader unavailable.');
      }

      const chunks: Uint8Array[] = [];
      let receivedLength = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          receivedLength += value.length;
          if (contentLength > 0) {
            setDownloadProgress(
              Math.min(99, Math.round((receivedLength / contentLength) * 100))
            );
          }
        }
      }

      setDownloadProgress(100);
      const blob = new Blob(chunks as BlobPart[], { type: 'video/mp4' });
      const blobUrl = URL.createObjectURL(blob);
      setLocalBlobUrl(blobUrl);
      triggerBrowserDownload(blobUrl);
    } catch (err: unknown) {
      setDownloadError(
        err instanceof Error ? err.message : 'Download interrupted'
      );
    } finally {
      setTimeout(() => {
        setDownloading(false);
        setDownloadProgress(0);
      }, 900);
    }
  };

  const getShareableInviteUrl = () => {
    if (typeof window === 'undefined' || !project) return '';
    return `${window.location.origin}/invite/${project.slug}`;
  };

  const handleCopyLink = async () => {
    const url = getShareableInviteUrl();
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleWhatsAppShare = () => {
    if (!project) return;
    const url = getShareableInviteUrl();
    const message =
      `॥ श्री गणेशाय नमः ॥\n\n` +
      `✨ *Wedding Invitation: ${project.brideName} Weds ${project.groomName}* ✨\n\n` +
      `With joyful hearts, we cordially invite you and your family to grace the auspicious wedding celebrations:\n` +
      `📅 *Date:* ${formatReadableDate(project.weddingDate)} at ${project.weddingTime}\n` +
      `📍 *Venue:* ${project.weddingVenue}, ${project.weddingAddress}\n\n` +
      `🎬 *Watch Our Animated Wedding Invitation Video:* \n${url}`;

    const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handleRetryRender = async () => {
    if (!job) return;
    setRetrying(true);
    setJob({
      ...job,
      status: 'processing',
      progress: 12,
      errorMessage: undefined,
      stageMessage: 'Re-rendering your HD Wedding Video...',
    });
    try {
      const res = await fetch(`/api/jobs/${job.id}`, { method: 'POST' });
      const data = await res.json();
      if (data.job) {
        setJob(data.job);
      }
      if (data.project) {
        setProject(data.project);
      }
    } finally {
      setRetrying(false);
    }
  };

  const handleTogglePrivacy = async () => {
    if (!project) return;
    const nextPublic = !project.isPublic;
    const res = await fetch(`/api/projects/${project.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublic: nextPublic }),
    });
    const data = await res.json();
    if (data.project) {
      setProject(data.project);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-3 bg-[#FDF6EC]">
        <Loader2 className="w-10 h-10 text-[#5C0A1B] animate-spin" />
        <p className="text-base font-semibold text-[#5C0A1B]">
          Loading Your Wedding Invitation Project...
        </p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="max-w-xl mx-auto my-20 p-8 rounded-3xl bg-white border-ornate text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-amber-600 mx-auto" />
        <h2 className="text-2xl font-bold font-royal text-[#5C0A1B]">
          Invitation Project Not Found
        </h2>
        <p className="text-sm text-[#5C0A1B]/75">{error}</p>
        <Link
          href="/create"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#5C0A1B] text-[#FFFDF9] font-semibold text-sm"
        >
          Create a New Invitation
        </Link>
      </div>
    );
  }

  const isRendering =
    job && (job.status === 'queued' || job.status === 'processing');
  const isFailed = job && job.status === 'failed';
  const isCompleted = job && job.status === 'completed';

  return (
    <div className="min-h-screen bg-[#FDF6EC] py-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* RENDERING IN PROGRESS CARD */}
        {isRendering && (
          <div className="max-w-2xl mx-auto bg-white rounded-3xl p-8 sm:p-10 border-ornate text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-[#5C0A1B] text-[#D4AF37] flex items-center justify-center mx-auto shadow-lg">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-[#9E7D1B]">
                Real Server-Side H.264 + AAC Rendering
              </span>
              <h1 className="text-3xl sm:text-4xl font-bold font-royal text-[#5C0A1B] mt-1">
                Crafting Your Royal Wedding Video...
              </h1>
              <p className="text-sm text-[#5C0A1B]/75 mt-2">
                {job.stageMessage}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-[#5C0A1B]">
                <span>Rendering 1080×1920 @ 30 FPS</span>
                <span>{job.progress}%</span>
              </div>
              <div className="w-full h-4 rounded-full bg-amber-100 overflow-hidden p-0.5 border border-[#D4AF37]/50">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#5C0A1B] via-[#82142B] to-[#D4AF37] transition-all duration-300"
                  style={{ width: `${Math.max(5, job.progress)}%` }}
                />
              </div>
            </div>

            <p className="text-xs text-[#5C0A1B]/65">
              You can safely refresh this page — your rendering job runs in our
              persistent background queue.
            </p>
          </div>
        )}

        {/* FAILED RENDER CARD WITH RETRY */}
        {isFailed && (
          <div className="max-w-2xl mx-auto bg-white rounded-3xl p-8 border-2 border-red-300 text-center space-y-5 shadow-lg">
            <AlertTriangle className="w-12 h-12 text-red-600 mx-auto" />
            <h2 className="text-2xl sm:text-3xl font-bold font-royal text-[#5C0A1B]">
              Video Rendering Encountered an Issue
            </h2>
            <p className="text-sm text-red-800 bg-red-50 p-3.5 rounded-xl border border-red-200">
              {job.errorMessage || 'An unexpected error occurred while encoding MP4.'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <button
                type="button"
                disabled={retrying}
                onClick={handleRetryRender}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#5C0A1B] text-[#FFFDF9] font-semibold text-sm hover:bg-[#82142B] transition"
              >
                <RefreshCw
                  className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`}
                />
                <span>Retry Rendering Now</span>
              </button>
              <Link
                href={`/create?edit=${project.id}`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-50 text-[#5C0A1B] border border-[#D4AF37] font-semibold text-sm"
              >
                <Edit3 className="w-4 h-4" />
                <span>Edit Details &amp; Try Again</span>
              </Link>
            </div>
          </div>
        )}

        {/* COMPLETED READY VIEW */}
        {isCompleted && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left 5 Columns: Vertical 9:16 Rendered MP4 Video Player */}
            <div className="lg:col-span-5 flex flex-col items-center">
              <div className="rounded-[34px] p-3 bg-gradient-to-b from-[#2A040C] via-[#4A0715] to-[#1E0208] shadow-2xl border-2 border-[#D4AF37] w-full max-w-[350px]">
                <div className="w-20 h-1.5 bg-[#D4AF37]/40 rounded-full mx-auto mb-2.5" />
                <div className="rounded-[24px] overflow-hidden bg-black aspect-[9/16] relative">
                  <video
                    key={videoStreamUrl}
                    src={videoStreamUrl}
                    controls
                    autoPlay
                    playsInline
                    onError={() => void handleVideoPlayerError()}
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>

              <div className="mt-3 flex items-center gap-3 text-xs text-[#5C0A1B]/80 font-medium">
                <span className="flex items-center gap-1">
                  <Film className="w-3.5 h-3.5 text-[#D4AF37]" />
                  {job.resolution} • {job.fps} FPS • H.264 + AAC
                </span>
                {job.outputSizeBytes && (
                  <span>
                    • {(job.outputSizeBytes / (1024 * 1024)).toFixed(2)} MB
                  </span>
                )}
              </div>
            </div>

            {/* Right 7 Columns: Action Buttons & Invitation Summary */}
            <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-9 border-ornate space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>1080×1920 Full HD MP4 Generated Successfully</span>
              </div>

              <h1 className="text-3xl sm:text-4xl font-bold font-royal text-[#5C0A1B]">
                Your Wedding Invitation Is Ready!
              </h1>

              <p className="text-sm text-[#5C0A1B]/75 leading-relaxed">
                Your custom animated invitation for{' '}
                <strong className="text-[#5C0A1B]">
                  {project.brideName} &amp; {project.groomName}
                </strong>{' '}
                has been rendered with synchronized music and is ready for
                WhatsApp Status, Instagram Reels, and direct family sharing.
              </p>

              {/* Download Progress or Error Feedback */}
              {downloading && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-[#D4AF37] space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-[#5C0A1B]">
                    <span>Downloading HD MP4 Video...</span>
                    <span>{downloadProgress}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-amber-200 overflow-hidden">
                    <div
                      className="h-full bg-[#5C0A1B] transition-all"
                      style={{ width: `${downloadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {downloadError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                  {downloadError}
                </div>
              )}

              {/* Required 4 Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                <button
                  type="button"
                  disabled={downloading}
                  onClick={handleDownloadMp4}
                  className="py-4 px-5 rounded-2xl bg-gold-shimmer text-[#3B0510] font-bold text-base shadow-lg hover:brightness-105 transition flex items-center justify-center gap-2.5"
                >
                  <Download className="w-5 h-5" />
                  <span>Download HD Video</span>
                </button>

                <button
                  type="button"
                  onClick={handleWhatsAppShare}
                  className="py-4 px-5 rounded-2xl bg-[#128C7E] hover:bg-[#075E54] text-white font-bold text-base shadow-lg transition flex items-center justify-center gap-2.5"
                >
                  <Share2 className="w-5 h-5" />
                  <span>Share on WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="py-3.5 px-5 rounded-2xl bg-[#5C0A1B] hover:bg-[#82142B] text-[#FFFDF9] font-semibold text-sm transition flex items-center justify-center gap-2"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-4 h-4 text-[#D4AF37]" />
                      <span>Invitation Link Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-[#D4AF37]" />
                      <span>Copy Invitation Link</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => router.push(`/create?edit=${project.id}`)}
                  className="py-3.5 px-5 rounded-2xl bg-[#FDF6EC] hover:bg-amber-100 text-[#5C0A1B] border border-[#D4AF37] font-semibold text-sm transition flex items-center justify-center gap-2"
                >
                  <Edit3 className="w-4 h-4 text-[#5C0A1B]" />
                  <span>Edit &amp; Regenerate</span>
                </button>
              </div>

              {/* Shareable Link & Privacy Control */}
              <div className="p-4 rounded-2xl bg-[#FDF6EC] border border-[#D4AF37]/40 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-bold text-[#5C0A1B] flex items-center gap-1.5">
                    {project.isPublic ? (
                      <>
                        <Globe className="w-4 h-4 text-emerald-700" />
                        <span>Shareable Web Invitation Link is Active</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 text-amber-700" />
                        <span>Invitation Link is Private (Only You)</span>
                      </>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleTogglePrivacy}
                    className="text-xs font-semibold text-[#5C0A1B] underline hover:text-[#9E7D1B]"
                  >
                    Switch to {project.isPublic ? 'Private' : 'Public'}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={getShareableInviteUrl()}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#D4AF37]/40 text-xs text-[#5C0A1B] font-mono"
                  />
                  <Link
                    href={`/invite/${project.slug}`}
                    target="_blank"
                    className="px-3.5 py-2 rounded-xl bg-white border border-[#D4AF37]/50 text-xs font-bold text-[#5C0A1B] hover:bg-amber-50 shrink-0"
                  >
                    Open Page ↗
                  </Link>
                </div>
              </div>

              {/* Quick Summary of Wedding Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                  <div className="text-[#5C0A1B]/60 flex items-center gap-1 font-medium">
                    <Calendar className="w-3.5 h-3.5 text-[#D4AF37]" /> Wedding
                    Date
                  </div>
                  <div className="font-bold text-[#5C0A1B] mt-1">
                    {formatReadableDate(project.weddingDate)}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                  <div className="text-[#5C0A1B]/60 flex items-center gap-1 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-[#D4AF37]" /> Venue
                  </div>
                  <div className="font-bold text-[#5C0A1B] mt-1 truncate">
                    {project.weddingVenue}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                  <div className="text-[#5C0A1B]/60 flex items-center gap-1 font-medium">
                    <Music className="w-3.5 h-3.5 text-[#D4AF37]" /> Audio Track
                  </div>
                  <div className="font-bold text-[#5C0A1B] mt-1 truncate">
                    {project.music?.title}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
