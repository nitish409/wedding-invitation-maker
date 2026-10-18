'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  DEFAULT_MUSIC_TRACKS,
  DEFAULT_PROJECT_INPUT,
  DEFAULT_TEMPLATES,
} from '@/lib/constants/templates';
import { LanguageMode, TemplateId } from '@/types/wedding';
import {
  Sparkles,
  CheckCircle2,
  Music,
  Download,
  Share2,
  Camera,
  FileText,
  ArrowRight,
  Globe,
  Shield,
  Smartphone,
} from 'lucide-react';

const LiveRemotionPreview = dynamic(
  () =>
    import('@/components/LiveRemotionPreview').then(
      (mod) => mod.LiveRemotionPreview
    ),
  {
    ssr: false,
    loading: () => (
      <div className="w-[330px] aspect-[9/16] rounded-[32px] bg-[#3B0510] border-2 border-[#D4AF37]/50 flex items-center justify-center text-[#F3E5AB] text-sm animate-pulse">
        Loading 9:16 Royal Video Player...
      </div>
    ),
  }
);

export default function HomePage() {
  const [selectedTemplateId, setSelectedTemplateId] =
    useState<TemplateId>('royal-wedding');
  const [previewLang, setPreviewLang] = useState<LanguageMode>('mixed');

  const activeTemplate =
    DEFAULT_TEMPLATES.find((t) => t.id === selectedTemplateId) ||
    DEFAULT_TEMPLATES[0];

  const matchedTrack =
    DEFAULT_MUSIC_TRACKS.find((m) => m.id === activeTemplate.defaultMusicId) ||
    DEFAULT_MUSIC_TRACKS[0];

  const demoProject = {
    ...DEFAULT_PROJECT_INPUT,
    templateId: selectedTemplateId,
    language: previewLang,
    music: {
      ...DEFAULT_PROJECT_INPUT.music,
      trackId: matchedTrack.id,
      title: matchedTrack.title,
      url: matchedTrack.url,
    },
  };

  return (
    <div className="min-h-screen">
      {/* HERO SECTION */}
      <section className="bg-royal-gradient text-[#FFFDF9] relative overflow-hidden py-14 sm:py-20 border-b-4 border-[#D4AF37]">
        {/* Decorative Mandala Corner Glow */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#D4AF37]/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[#D4AF37]/10 blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column: Headline, 3 Steps Banner, CTA */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/50 text-[#F3E5AB] text-xs sm:text-sm font-medium">
                <span>॥ श्री गणेशाय नमः ॥</span>
                <span>•</span>
                <span>1080×1920 Full HD Vertical MP4 Invitations</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-royal leading-tight text-[#FFFDF9]">
                Create Your Dream Wedding Invitation Video in Minutes
              </h1>

              <p className="text-base sm:text-lg text-[#F3E5AB]/90 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                Design breathtaking animated Indian wedding invitation videos with sacred
                Ganesh Ji invocation, golden mandalas, Haldi &amp; Mehndi ceremonies, your
                couple photographs, and traditional Shehnai or custom music — ready to
                download as an HD MP4 and share on WhatsApp.
              </p>

              {/* Required Three Steps Banner */}
              <div className="inline-flex flex-wrap items-center justify-center lg:justify-start gap-2 sm:gap-3 px-5 py-3 rounded-2xl bg-[#240209]/80 border border-[#D4AF37]/50 text-[#F3E5AB] font-semibold text-sm sm:text-base shadow-lg">
                <span className="text-[#D4AF37] font-bold">
                  Enter Details → Upload Photos → Download Video
                </span>
              </div>

              {/* Main CTA Button */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                <Link
                  href={`/create?template=${selectedTemplateId}`}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-full bg-gold-shimmer text-[#3B0510] font-bold text-lg shadow-xl hover:scale-[1.02] transition"
                >
                  <Sparkles className="w-5 h-5" />
                  <span>Create My Invitation</span>
                  <ArrowRight className="w-5 h-5" />
                </Link>

                <a
                  href="#templates"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-full bg-[#FFFDF9]/10 hover:bg-[#FFFDF9]/20 text-[#F3E5AB] border border-[#D4AF37]/40 font-semibold text-base transition"
                >
                  Explore 4 Royal Templates
                </a>
              </div>

              {/* Feature Pills */}
              <div className="pt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs sm:text-sm text-[#F3E5AB]/85">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#D4AF37] shrink-0" />
                  <span>Real 1080×1920 30FPS MP4</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#D4AF37] shrink-0" />
                  <span>English &amp; हिंदी Typography</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#D4AF37] shrink-0" />
                  <span>WhatsApp Status &amp; Reels Ready</span>
                </div>
              </div>
            </div>

            {/* Right Column: Live Interactive 9:16 Video Showcase */}
            <div className="lg:col-span-5 flex flex-col items-center">
              <div className="mb-3 flex flex-wrap items-center justify-center gap-1.5">
                {(['english', 'mixed', 'hindi'] as LanguageMode[]).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setPreviewLang(lang)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                      previewLang === lang
                        ? 'bg-[#D4AF37] text-[#3B0510]'
                        : 'bg-[#240209]/70 text-[#F3E5AB] border border-[#D4AF37]/30'
                    }`}
                  >
                    <Globe className="w-3 h-3 inline mr-1" />
                    {lang === 'english'
                      ? 'English'
                      : lang === 'hindi'
                      ? 'हिंदी (Hindi)'
                      : 'Bilingual Mixed'}
                  </button>
                ))}
              </div>

              <LiveRemotionPreview project={demoProject} compact />

              {/* Quick Template Switcher Pills under Phone */}
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {DEFAULT_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setSelectedTemplateId(tpl.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition border ${
                      selectedTemplateId === tpl.id
                        ? 'bg-gold-shimmer text-[#3B0510] border-[#D4AF37] shadow-md'
                        : 'bg-[#240209]/80 text-[#F3E5AB] border-[#D4AF37]/35 hover:border-[#D4AF37]'
                    }`}
                  >
                    {tpl.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS: 3 EASY STEPS */}
      <section className="py-16 bg-[#FDF6EC] border-b border-[#D4AF37]/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-[#82142B] bg-rose-100 px-3 py-1 rounded-full border border-rose-200">
              Zero Video Editing Skills Needed
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold font-royal text-[#5C0A1B] mt-3">
              Enter Details → Upload Photos → Download Video
            </h2>
            <p className="text-sm sm:text-base text-[#5C0A1B]/75 mt-2">
              Our intelligent template engine automatically formats your ceremonies, crops
              your portraits without stretching faces, and synchronizes background music.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-3xl p-7 border-ornate relative">
              <div className="w-12 h-12 rounded-2xl bg-[#5C0A1B] text-[#D4AF37] flex items-center justify-center font-bold text-xl mb-5 shadow-md">
                <FileText className="w-6 h-6" />
              </div>
              <div className="text-xs font-bold uppercase tracking-wider text-[#9E7D1B]">
                Step 1
              </div>
              <h3 className="text-2xl font-bold font-royal text-[#5C0A1B] mt-1">
                Enter Wedding &amp; Ceremony Details
              </h3>
              <p className="text-sm text-[#5C0A1B]/75 mt-2 leading-relaxed">
                Enter Bride &amp; Groom names, parents&apos; blessings, and select which
                events to include (Haldi, Mehndi, Sangeet, Wedding, Reception). Unused
                events are automatically skipped.
              </p>
            </div>

            <div className="bg-white rounded-3xl p-7 border-ornate relative">
              <div className="w-12 h-12 rounded-2xl bg-[#5C0A1B] text-[#D4AF37] flex items-center justify-center font-bold text-xl mb-5 shadow-md">
                <Camera className="w-6 h-6" />
              </div>
              <div className="text-xs font-bold uppercase tracking-wider text-[#9E7D1B]">
                Step 2
              </div>
              <h3 className="text-2xl font-bold font-royal text-[#5C0A1B] mt-1">
                Upload Photos &amp; Select Song
              </h3>
              <p className="text-sm text-[#5C0A1B]/75 mt-2 leading-relaxed">
                Upload Bride, Groom, and Couple photos (JPG, PNG, WebP) with easy zoom and
                reposition sliders. Pick a royalty-free Shehnai/Sitar track or upload your
                own MP3/WAV song.
              </p>
            </div>

            <div className="bg-white rounded-3xl p-7 border-ornate relative">
              <div className="w-12 h-12 rounded-2xl bg-[#5C0A1B] text-[#D4AF37] flex items-center justify-center font-bold text-xl mb-5 shadow-md">
                <Download className="w-6 h-6" />
              </div>
              <div className="text-xs font-bold uppercase tracking-wider text-[#9E7D1B]">
                Step 3
              </div>
              <h3 className="text-2xl font-bold font-royal text-[#5C0A1B] mt-1">
                Download HD MP4 &amp; Share on WhatsApp
              </h3>
              <p className="text-sm text-[#5C0A1B]/75 mt-2 leading-relaxed">
                Press one button to generate a real 1080×1920 H.264 + AAC MP4 video with
                smooth audio fade-in/out. Download immediately or share directly with
                family on WhatsApp!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* GALLERY OF 4 WEDDING TEMPLATES */}
      <section id="templates" className="py-16 sm:py-20 bg-[#FFFDF9]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-[#5C0A1B] bg-amber-100 px-3 py-1 rounded-full border border-amber-300">
              Handcrafted Indian Aesthetics
            </span>
            <h2 className="text-3xl sm:text-5xl font-bold font-royal text-[#5C0A1B] mt-3">
              Signature Wedding Invitation Templates
            </h2>
            <p className="text-base text-[#5C0A1B]/75 mt-2">
              Every template features 9 dynamic scenes, custom cultural motifs, smooth
              photo reveals, and full English &amp; Hindi font support.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-7">
            {DEFAULT_TEMPLATES.map((tpl) => (
              <div
                key={tpl.id}
                className="rounded-3xl overflow-hidden bg-white border-2 border-[#D4AF37]/50 shadow-lg hover:shadow-2xl transition flex flex-col justify-between group"
              >
                <div>
                  {/* Visual Preview Card Header */}
                  <div
                    className="h-64 p-5 flex flex-col justify-between relative overflow-hidden"
                    style={{
                      background: `radial-gradient(circle at 50% 30%, ${tpl.bgColor} 0%, ${tpl.bgGradientEnd} 100%)`,
                      color: tpl.textColor,
                    }}
                  >
                    <div
                      className="absolute inset-3 border-2 rounded-2xl pointer-events-none"
                      style={{ borderColor: `${tpl.secondaryColor}88` }}
                    />

                    <div className="relative z-10 flex items-center justify-between">
                      <span
                        className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full"
                        style={{
                          backgroundColor: tpl.secondaryColor,
                          color: '#240209',
                        }}
                      >
                        {tpl.previewBadge}
                      </span>
                      <span
                        className="text-xs font-semibold"
                        style={{ color: tpl.secondaryColor }}
                      >
                        9:16 HD
                      </span>
                    </div>

                    <div className="relative z-10 text-center my-auto space-y-1">
                      <div
                        className="text-xs tracking-widest uppercase"
                        style={{ color: tpl.secondaryColor }}
                      >
                        ॥ श्री गणेशाय नमः ॥
                      </div>
                      <div
                        className="text-2xl font-bold font-royal"
                        style={{ color: tpl.secondaryColor }}
                      >
                        {tpl.nameHindi}
                      </div>
                      <div className="text-sm font-medium opacity-90">{tpl.name}</div>
                    </div>

                    <div className="relative z-10 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTemplateId(tpl.id);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="text-xs font-semibold underline underline-offset-4 hover:opacity-80"
                        style={{ color: tpl.secondaryColor }}
                      >
                        Preview Live in Top Player ↑
                      </button>
                    </div>
                  </div>

                  {/* Card Details */}
                  <div className="p-6">
                    <div className="text-xs font-semibold text-[#9E7D1B] uppercase tracking-wider">
                      {tpl.subtitle}
                    </div>
                    <h3 className="text-2xl font-bold font-royal text-[#5C0A1B] mt-0.5">
                      {tpl.name}
                    </h3>
                    <p className="text-xs text-[#5C0A1B]/75 mt-2 leading-relaxed">
                      {tpl.description}
                    </p>

                    <ul className="mt-4 space-y-1.5">
                      {tpl.features.map((feat, i) => (
                        <li
                          key={i}
                          className="text-xs text-[#5C0A1B] flex items-center gap-2"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
                          {feat}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="p-6 pt-0">
                  <Link
                    href={`/create?template=${tpl.id}`}
                    className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#5C0A1B] hover:bg-[#82142B] text-[#FFFDF9] font-semibold text-sm transition shadow-md"
                  >
                    <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                    <span>Select {tpl.name}</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TRUST & FEATURES BANNER */}
      <section className="py-14 bg-[#3B0510] text-[#FFFDF9] border-t border-[#D4AF37]/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="flex items-start gap-3.5">
            <Smartphone className="w-7 h-7 text-[#D4AF37] shrink-0 mt-1" />
            <div>
              <h4 className="font-bold font-royal text-xl text-[#F3E5AB]">
                9:16 Vertical Full HD
              </h4>
              <p className="text-xs text-[#F3E5AB]/75 mt-1">
                1080×1920 @ 30 FPS H.264 MP4 tailored for WhatsApp Status, Instagram
                Reels, and mobile viewing.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <Music className="w-7 h-7 text-[#D4AF37] shrink-0 mt-1" />
            <div>
              <h4 className="font-bold font-royal text-xl text-[#F3E5AB]">
                Custom &amp; Traditional Music
              </h4>
              <p className="text-xs text-[#F3E5AB]/75 mt-1">
                Choose from licensed Shehnai, Sitar, Dhol, or Veena instrumentals, or
                upload your own MP3/WAV with automatic fade-in/out.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <Share2 className="w-7 h-7 text-[#D4AF37] shrink-0 mt-1" />
            <div>
              <h4 className="font-bold font-royal text-xl text-[#F3E5AB]">
                Instant WhatsApp Sharing
              </h4>
              <p className="text-xs text-[#F3E5AB]/75 mt-1">
                Download your MP4 video or share a private/public RSVP invitation page
                with Google Maps directions.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <Shield className="w-7 h-7 text-[#D4AF37] shrink-0 mt-1" />
            <div>
              <h4 className="font-bold font-royal text-xl text-[#F3E5AB]">
                Private &amp; Secure Storage
              </h4>
              <p className="text-xs text-[#F3E5AB]/75 mt-1">
                Your family photos are stored privately with signed expiring download
                links and no mandatory signup required.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
