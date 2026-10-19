'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { RenderJob, WeddingProject } from '@/types/wedding';
import { formatReadableDate, getLocalizedCopy } from '@/lib/video/sceneCalculator';
import {
  MapPin,
  Calendar,
  Clock,
  Phone,
  Download,
  Lock,
  Sparkles,
} from 'lucide-react';

export default function PublicInviteSharePage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [project, setProject] = useState<WeddingProject | null>(null);
  const [job, setJob] = useState<RenderJob | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${slug}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (data.project) setProject(data.project);
        if (data.job) setJob(data.job);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-royal-gradient text-[#F3E5AB]">
        Loading Royal Wedding Invitation...
      </div>
    );
  }

  if (!project || project.isPublic === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-royal-gradient text-[#FFFDF9] p-6 text-center">
        <Lock className="w-12 h-12 text-[#D4AF37] mb-3" />
        <h1 className="text-3xl font-bold font-royal text-[#D4AF37]">
          Private Wedding Invitation
        </h1>
        <p className="text-sm text-[#F3E5AB]/80 max-w-md mt-2">
          This invitation link is currently set to private by the host family or
          does not exist.
        </p>
        <Link
          href="/"
          className="mt-6 px-6 py-2.5 rounded-full bg-gold-shimmer text-[#3B0510] font-bold text-sm"
        >
          Visit ShubhVivah Studio
        </Link>
      </div>
    );
  }

  const copy = getLocalizedCopy(project.language);
  const enabledEvents = (project.events || []).filter((e) => e.enabled);
  const videoUrl =
    job && job.status === 'completed'
      ? `/api/projects/${project.id}?stream=1&jobId=${encodeURIComponent(
          job.id
        )}&token=${encodeURIComponent(job.downloadToken || '')}`
      : project.renderedVideoUrl;

  return (
    <div className="min-h-screen bg-royal-gradient text-[#FFFDF9] py-12 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-10">
        {/* Header Invocation */}
        <div className="text-center space-y-2">
          <div className="text-sm sm:text-base text-[#D4AF37] font-semibold tracking-widest">
            {copy.invocation}
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold font-royal text-[#F3E5AB]">
            {project.brideName} &amp; {project.groomName}
          </h1>
          <p className="text-sm sm:text-base text-[#F3E5AB]/80 max-w-xl mx-auto">
            {project.familyMessage}
          </p>
        </div>

        {/* Video Player Centerpiece */}
        {videoUrl && (
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-[34px] p-3 bg-[#240209] border-2 border-[#D4AF37] shadow-2xl w-full max-w-[350px]">
              <div className="rounded-[24px] overflow-hidden aspect-[9/16] bg-black">
                <video
                  src={videoUrl}
                  controls
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            <a
              href={`${videoUrl}&download=1`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gold-shimmer text-[#3B0510] font-bold text-sm shadow-lg"
            >
              <Download className="w-4 h-4" />
              <span>Download Invitation Video (MP4)</span>
            </a>
          </div>
        )}

        {/* Ceremony Schedule Cards */}
        <div className="bg-[#240209]/80 rounded-3xl p-6 sm:p-8 border border-[#D4AF37]/50 space-y-6">
          <h2 className="text-2xl sm:text-3xl font-bold font-royal text-center text-[#D4AF37]">
            {copy.ceremonyHeader}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {enabledEvents.map((evt) => (
              <div
                key={evt.id}
                className="p-5 rounded-2xl bg-[#3B0510]/90 border border-[#D4AF37]/40 space-y-2"
              >
                <h3 className="text-xl font-bold font-royal text-[#D4AF37]">
                  {evt.name}
                </h3>
                <div className="text-xs text-[#F3E5AB] flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#D4AF37]" />
                  {formatReadableDate(evt.date)}
                </div>
                <div className="text-xs text-[#F3E5AB] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#D4AF37]" />
                  {evt.time}
                </div>
                <div className="text-xs text-[#F3E5AB] flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#D4AF37]" />
                  {evt.venue}
                </div>
              </div>
            ))}

            {/* Main Wedding Card */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-[#5C0A1B] to-[#3B0510] border-2 border-[#D4AF37] space-y-2 md:col-span-2">
              <div className="text-xs font-bold uppercase tracking-widest text-[#D4AF37]">
                {copy.weddingHeader}
              </div>
              <h3 className="text-2xl font-bold font-royal text-[#FFFDF9]">
                {formatReadableDate(project.weddingDate)} • {project.weddingTime}
              </h3>
              <p className="text-sm text-[#F3E5AB] font-medium">
                {project.weddingVenue} — {project.weddingAddress}
              </p>
              {project.mapsUrl && (
                <div className="pt-2">
                  <a
                    href={project.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#D4AF37] text-[#3B0510] font-bold text-xs"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    Open Venue in Google Maps
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* RSVP Footer */}
          <div className="text-center pt-4 border-t border-[#D4AF37]/30 space-y-1">
            <div className="text-sm font-bold text-[#D4AF37]">
              {project.rsvpDetails}
            </div>
            {project.contactPhone && (
              <div className="text-xs text-[#F3E5AB] flex items-center justify-center gap-1">
                <Phone className="w-3.5 h-3.5 text-[#D4AF37]" />
                {project.contactPhone}
              </div>
            )}
          </div>
        </div>

        <div className="text-center">
          <Link
            href="/create"
            className="inline-flex items-center gap-2 text-xs text-[#F3E5AB]/75 hover:text-[#D4AF37]"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Create Your Own Wedding Invitation Video on ShubhVivah Studio
          </Link>
        </div>
      </div>
    </div>
  );
}
