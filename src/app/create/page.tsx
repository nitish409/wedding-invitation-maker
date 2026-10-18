'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  CeremonyEvent,
  CeremonyType,
  LanguageMode,
  MusicTrackItem,
  TemplateDefinition,
  WeddingProjectInput,
} from '@/types/wedding';
import {
  DEFAULT_MUSIC_TRACKS,
  DEFAULT_PROJECT_INPUT,
  DEFAULT_TEMPLATES,
} from '@/lib/constants/templates';
import { calculateWeddingScenes } from '@/lib/video/sceneCalculator';
import { PhotoUploaderCropper } from '@/components/PhotoUploaderCropper';
import {
  Sparkles,
  Check,
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Music,
  Upload,
  Volume2,
  Clock,
  Globe,
  AlertCircle,
  Loader2,
  Play,
  Pause,
  Wand2,
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
        Loading Live Preview...
      </div>
    ),
  }
);

const STEPS = [
  { id: 1, title: '1. Select Template', subtitle: 'Theme & Language' },
  { id: 2, title: '2. Wedding Details', subtitle: 'Names & Ceremonies' },
  { id: 3, title: '3. Upload Photos', subtitle: 'Crop & Frame Portraits' },
  { id: 4, title: '4. Music & Create', subtitle: 'Song & Generate MP4' },
];

function CreateInvitationWizardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTemplate = searchParams.get('template');
  const editProjectId = searchParams.get('edit');

  const [step, setStep] = useState<number>(1);
  const [templates, setTemplates] =
    useState<TemplateDefinition[]>(DEFAULT_TEMPLATES);
  const [musicTracks, setMusicTracks] =
    useState<MusicTrackItem[]>(DEFAULT_MUSIC_TRACKS);
  const [project, setProject] = useState<WeddingProjectInput>(() => {
    if (
      initialTemplate &&
      DEFAULT_TEMPLATES.some((t) => t.id === initialTemplate)
    ) {
      const tpl = DEFAULT_TEMPLATES.find((t) => t.id === initialTemplate)!;
      const track =
        DEFAULT_MUSIC_TRACKS.find((m) => m.id === tpl.defaultMusicId) ||
        DEFAULT_MUSIC_TRACKS[0];
      return {
        ...DEFAULT_PROJECT_INPUT,
        templateId: tpl.id,
        music: {
          ...DEFAULT_PROJECT_INPUT.music,
          trackId: track.id,
          title: track.title,
          url: track.url,
        },
      };
    }
    return DEFAULT_PROJECT_INPUT;
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  // Fetch active templates, music tracks, and existing project if in edit mode
  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((data) => {
        if (data.templates?.length) setTemplates(data.templates);
        if (data.musicTracks?.length) setMusicTracks(data.musicTracks);
      })
      .catch(() => {});

    if (editProjectId) {
      fetch(`/api/projects/${editProjectId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.project) {
            setProject(data.project);
          }
        })
        .catch(() => {});
    }
  }, [editProjectId]);

  const { scenes, totalDurationSec } = calculateWeddingScenes(project, 30);

  const handleSelectTemplate = (tpl: TemplateDefinition) => {
    const defaultTrack =
      musicTracks.find((m) => m.id === tpl.defaultMusicId) || musicTracks[0];
    setProject((prev) => ({
      ...prev,
      templateId: tpl.id,
      music:
        prev.music.trackId === 'custom'
          ? prev.music
          : {
              ...prev.music,
              trackId: defaultTrack.id,
              title: defaultTrack.title,
              url: defaultTrack.url,
            },
    }));
  };

  const loadHindiDemoData = () => {
    setProject((prev) => ({
      ...prev,
      language: 'hindi',
      brideName: 'अनन्या शर्मा (Ananya)',
      groomName: 'आरव सिंघानिया (Aarav)',
      brideParents: 'श्रीमती कविता एवं श्री राजेश्वर शर्मा',
      groomParents: 'श्रीमती सुनीता एवं श्री विक्रमादित्य सिंघानिया',
      familyMessage:
        'भगवान श्री गणेश की असीम कृपा एवं बुजुर्गों के आशीर्वाद से हमारे बच्चों के शुभ विवाह के पावन अवसर पर आप सपरिवार सादर आमंत्रित हैं।',
      hashtag: '#आरव_अनन्या_विवाह',
      weddingVenue: 'सुवर्ण महल, रामबाग पैलेस, जयपुर',
      weddingAddress: 'भवानी सिंह रोड, रामबाग, जयपुर, राजस्थान 302005',
      rsvpDetails: 'दर्शनाभिलाषी: समस्त शर्मा एवं सिंघानिया परिवार',
    }));
  };

  const loadEnglishDemoData = () => {
    setProject((prev) => ({
      ...DEFAULT_PROJECT_INPUT,
      templateId: prev.templateId,
      language: 'mixed',
    }));
  };

  // Ceremony Event Handlers
  const updateEvent = (id: string, patch: Partial<CeremonyEvent>) => {
    setProject((prev) => ({
      ...prev,
      events: prev.events.map((ev) => (ev.id === id ? { ...ev, ...patch } : ev)),
    }));
  };

  const moveEvent = (index: number, direction: -1 | 1) => {
    setProject((prev) => {
      const next = [...prev.events];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      const temp = next[index];
      next[index] = next[target];
      next[target] = temp;
      return { ...prev, events: next };
    });
  };

  const removeEvent = (id: string) => {
    setProject((prev) => ({
      ...prev,
      events: prev.events.filter((ev) => ev.id !== id),
    }));
  };

  const addCustomEvent = (presetType: CeremonyType = 'custom') => {
    const titles: Record<CeremonyType, string> = {
      haldi: 'Haldi Ceremony',
      mehndi: 'Mehndi Celebration',
      sangeet: 'Sangeet Musical Night',
      engagement: 'Engagement (Sagai)',
      wedding: 'Vedic Pheras Ceremony',
      reception: 'Grand Reception',
      custom: 'Tilak / Baraat Welcome',
    };
    const newEvt: CeremonyEvent = {
      id: `evt-${Date.now()}`,
      type: presetType,
      name: titles[presetType],
      enabled: true,
      date: project.weddingDate || '2026-12-12',
      time: '05:00 PM Onwards',
      venue: project.weddingVenue || 'Royal Courtyard Lawn',
      address: project.weddingAddress || '',
      customMessage: 'Join us for blessings & celebrations',
    };
    setProject((prev) => ({
      ...prev,
      events: [...prev.events, newEvt],
    }));
  };

  // Custom Audio Upload Handler
  const handleCustomAudioUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setUploadingAudio(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'audio');

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Audio upload failed');
      }

      setProject((prev) => ({
        ...prev,
        music: {
          ...prev.music,
          trackId: 'custom',
          title: `${data.title} (Custom Upload)`,
          url: data.url,
          startOffsetSec: 0,
        },
      }));
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to upload song');
    } finally {
      setUploadingAudio(false);
      e.target.value = '';
    }
  };

  const toggleAudioPreview = () => {
    const audio = audioPreviewRef.current;
    if (!audio) return;
    if (isPlayingAudio) {
      audio.pause();
      setIsPlayingAudio(false);
    } else {
      audio.currentTime = project.music.startOffsetSec || 0;
      audio.volume = project.music.volume ?? 0.85;
      audio
        .play()
        .then(() => setIsPlayingAudio(true))
        .catch(() => setIsPlayingAudio(false));
    }
  };

  const handleCreateWeddingVideo = async () => {
    setErrorMsg(null);

    if (!project.brideName.trim() || !project.groomName.trim()) {
      setErrorMsg("Please enter both Bride's and Groom's full names.");
      setStep(2);
      return;
    }
    if (!project.weddingDate.trim() || !project.weddingVenue.trim()) {
      setErrorMsg('Please enter the Wedding Date and Venue.');
      setStep(2);
      return;
    }
    if (!project.consentAccepted) {
      setErrorMsg(
        'Please accept the privacy consent checkbox in Step 3 to process your uploaded photos.'
      );
      setStep(3);
      return;
    }

    setSubmitting(true);
    try {
      const endpoint = editProjectId
        ? `/api/projects/${editProjectId}`
        : '/api/projects';
      const method = editProjectId ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...project,
          startRender: true,
          regenerate: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to start video generation');
      }

      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
      }

      router.push(`/project/${data.project.id}`);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to create wedding video'
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDF6EC] py-8 sm:py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Progress Wizard Stepper */}
        <div className="bg-white rounded-3xl p-4 sm:p-6 border-ornate mb-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {STEPS.map((s) => {
              const active = step === s.id;
              const completed = step > s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStep(s.id)}
                  className={`flex items-center gap-3 p-3 rounded-2xl text-left transition border ${
                    active
                      ? 'bg-[#5C0A1B] text-[#FFFDF9] border-[#D4AF37] shadow-md'
                      : completed
                      ? 'bg-amber-50/80 text-[#5C0A1B] border-[#D4AF37]/50'
                      : 'bg-stone-50 text-[#5C0A1B]/65 border-stone-200 hover:bg-amber-50/40'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                      active
                        ? 'bg-[#D4AF37] text-[#3B0510]'
                        : completed
                        ? 'bg-emerald-600 text-white'
                        : 'bg-stone-200 text-stone-700'
                    }`}
                  >
                    {completed ? <Check className="w-4 h-4" /> : s.id}
                  </div>
                  <div className="overflow-hidden">
                    <div className="font-bold text-xs sm:text-sm truncate">
                      {s.title}
                    </div>
                    <div
                      className={`text-[11px] truncate ${
                        active ? 'text-[#F3E5AB]' : 'text-[#5C0A1B]/60'
                      }`}
                    >
                      {s.subtitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Error Alert Banner */}
        {errorMsg && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 border-2 border-red-300 text-red-900 flex items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3 text-sm font-medium">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-xs font-bold underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Main Two-Column Layout: Left = Active Step Form, Right = Sticky 9:16 Live Video Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT 7 COLUMNS: STEP CONTROLS */}
          <div className="lg:col-span-7 space-y-6">
            {/* STEP 1: SELECT TEMPLATE & LANGUAGE */}
            {step === 1 && (
              <div className="bg-white rounded-3xl p-6 sm:p-8 border-ornate space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#D4AF37]/30 pb-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-widest text-[#9E7D1B]">
                      Step 1 of 4
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-bold font-royal text-[#5C0A1B]">
                      Choose Your Wedding Video Template
                    </h2>
                  </div>

                  {/* Quick Demo Data Presets */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={loadEnglishDemoData}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-[#5C0A1B] border border-[#D4AF37]/50 text-xs font-semibold transition"
                    >
                      <Wand2 className="w-3.5 h-3.5 text-[#D4AF37]" />
                      Royal Demo
                    </button>
                    <button
                      type="button"
                      onClick={loadHindiDemoData}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-[#5C0A1B] border border-[#D4AF37]/50 text-xs font-semibold transition"
                    >
                      <Globe className="w-3.5 h-3.5 text-[#D4AF37]" />
                      हिंदी Demo
                    </button>
                  </div>
                </div>

                {/* Language Selector */}
                <div className="bg-[#FDF6EC] p-4 rounded-2xl border border-[#D4AF37]/40">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#5C0A1B] mb-2.5">
                    Select Invitation Typography &amp; Language Mode:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {(
                      [
                        {
                          id: 'mixed',
                          label: 'Bilingual (English + हिंदी)',
                          desc: 'Shubh Vivah + English Details',
                        },
                        {
                          id: 'english',
                          label: 'Classic English',
                          desc: 'All titles & headings in English',
                        },
                        {
                          id: 'hindi',
                          label: 'शुद्ध हिंदी (Devanagari)',
                          desc: 'Traditional Hindi headings',
                        },
                      ] as const
                    ).map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() =>
                          setProject((p) => ({
                            ...p,
                            language: l.id as LanguageMode,
                          }))
                        }
                        className={`p-3 rounded-xl text-left border transition ${
                          project.language === l.id
                            ? 'bg-[#5C0A1B] text-[#FFFDF9] border-[#D4AF37] shadow-sm'
                            : 'bg-white text-[#5C0A1B] border-[#D4AF37]/30 hover:bg-amber-50/50'
                        }`}
                      >
                        <div className="font-bold text-xs sm:text-sm">
                          {l.label}
                        </div>
                        <div
                          className={`text-[11px] mt-0.5 ${
                            project.language === l.id
                              ? 'text-[#F3E5AB]'
                              : 'text-[#5C0A1B]/65'
                          }`}
                        >
                          {l.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Template Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {templates.map((tpl) => {
                    const isSelected = project.templateId === tpl.id;
                    return (
                      <div
                        key={tpl.id}
                        onClick={() => handleSelectTemplate(tpl)}
                        className={`cursor-pointer rounded-2xl overflow-hidden border-2 transition ${
                          isSelected
                            ? 'border-[#5C0A1B] ring-4 ring-[#D4AF37]/40 shadow-lg'
                            : 'border-[#D4AF37]/40 hover:border-[#5C0A1B]/60'
                        }`}
                      >
                        <div
                          className="h-36 p-4 flex flex-col justify-between relative"
                          style={{
                            background: `radial-gradient(circle at 50% 30%, ${tpl.bgColor} 0%, ${tpl.bgGradientEnd} 100%)`,
                            color: tpl.textColor,
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full"
                              style={{
                                background: tpl.secondaryColor,
                                color: '#240209',
                              }}
                            >
                              {tpl.previewBadge}
                            </span>
                            {isSelected && (
                              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1">
                                <Check className="w-3 h-3" /> Selected
                              </span>
                            )}
                          </div>
                          <div>
                            <div
                              className="text-lg font-bold font-royal"
                              style={{ color: tpl.secondaryColor }}
                            >
                              {tpl.nameHindi}
                            </div>
                            <div className="text-sm font-semibold">
                              {tpl.name}
                            </div>
                          </div>
                        </div>

                        <div className="p-4 bg-white">
                          <div className="text-xs font-bold text-[#9E7D1B]">
                            {tpl.subtitle}
                          </div>
                          <p className="text-xs text-[#5C0A1B]/75 mt-1 line-clamp-2">
                            {tpl.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP 2: WEDDING & CEREMONY DETAILS FORM */}
            {step === 2 && (
              <div className="bg-white rounded-3xl p-6 sm:p-8 border-ornate space-y-8">
                <div className="border-b border-[#D4AF37]/30 pb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-widest text-[#9E7D1B]">
                      Step 2 of 4
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-bold font-royal text-[#5C0A1B]">
                      Bride, Groom &amp; Ceremony Details
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={loadHindiDemoData}
                    className="text-xs font-semibold text-[#5C0A1B] underline hover:text-[#9E7D1B]"
                  >
                    Fill Sample Hindi Text (हिंदी)
                  </button>
                </div>

                {/* Personal Details Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold font-royal text-[#5C0A1B] flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#5C0A1B] text-[#D4AF37] text-xs flex items-center justify-center">
                      1
                    </span>
                    Couple &amp; Family Information
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#5C0A1B] mb-1">
                        Bride&apos;s Full Name (दुल्हन का नाम) *
                      </label>
                      <input
                        type="text"
                        value={project.brideName}
                        onChange={(e) =>
                          setProject({ ...project, brideName: e.target.value })
                        }
                        placeholder="e.g. Ananya Sharma / अनन्या शर्मा"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4AF37]/50 focus:outline-none focus:ring-2 focus:ring-[#5C0A1B] text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#5C0A1B] mb-1">
                        Groom&apos;s Full Name (दूल्हे का नाम) *
                      </label>
                      <input
                        type="text"
                        value={project.groomName}
                        onChange={(e) =>
                          setProject({ ...project, groomName: e.target.value })
                        }
                        placeholder="e.g. Aarav Singhania / आरव सिंघानिया"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4AF37]/50 focus:outline-none focus:ring-2 focus:ring-[#5C0A1B] text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#5C0A1B] mb-1">
                        Bride&apos;s Parents&apos; Names (Optional)
                      </label>
                      <input
                        type="text"
                        value={project.brideParents}
                        onChange={(e) =>
                          setProject({
                            ...project,
                            brideParents: e.target.value,
                          })
                        }
                        placeholder="Mrs. Kavita & Mr. Rajeshwar Sharma"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4AF37]/40 focus:outline-none focus:ring-2 focus:ring-[#5C0A1B] text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#5C0A1B] mb-1">
                        Groom&apos;s Parents&apos; Names (Optional)
                      </label>
                      <input
                        type="text"
                        value={project.groomParents}
                        onChange={(e) =>
                          setProject({
                            ...project,
                            groomParents: e.target.value,
                          })
                        }
                        placeholder="Mrs. Sunita & Mr. Vikramaditya Singhania"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4AF37]/40 focus:outline-none focus:ring-2 focus:ring-[#5C0A1B] text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#5C0A1B] mb-1">
                        Wedding Hashtag (Optional)
                      </label>
                      <input
                        type="text"
                        value={project.hashtag}
                        onChange={(e) =>
                          setProject({ ...project, hashtag: e.target.value })
                        }
                        placeholder="#AaravKiAnanya"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4AF37]/40 focus:outline-none focus:ring-2 focus:ring-[#5C0A1B] text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#5C0A1B] mb-1">
                        Contact Phone Number (Optional)
                      </label>
                      <input
                        type="text"
                        value={project.contactPhone}
                        onChange={(e) =>
                          setProject({
                            ...project,
                            contactPhone: e.target.value,
                          })
                        }
                        placeholder="+91 98290 11223"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4AF37]/40 focus:outline-none focus:ring-2 focus:ring-[#5C0A1B] text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#5C0A1B] mb-1">
                      Family Invitation Message (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={project.familyMessage}
                      onChange={(e) =>
                        setProject({
                          ...project,
                          familyMessage: e.target.value,
                        })
                      }
                      className="w-full px-3.5 py-2 rounded-xl border border-[#D4AF37]/40 focus:outline-none focus:ring-2 focus:ring-[#5C0A1B] text-sm"
                    />
                  </div>
                </div>

                {/* Main Wedding Venue & Date Section */}
                <div className="space-y-4 pt-4 border-t border-[#D4AF37]/30">
                  <h3 className="text-lg font-bold font-royal text-[#5C0A1B] flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#5C0A1B] text-[#D4AF37] text-xs flex items-center justify-center">
                      2
                    </span>
                    Main Wedding Ceremony Details
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#5C0A1B] mb-1">
                        Wedding Date *
                      </label>
                      <input
                        type="date"
                        value={project.weddingDate}
                        onChange={(e) =>
                          setProject({
                            ...project,
                            weddingDate: e.target.value,
                          })
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4AF37]/50 focus:outline-none focus:ring-2 focus:ring-[#5C0A1B] text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#5C0A1B] mb-1">
                        Wedding Time / Muhurat *
                      </label>
                      <input
                        type="text"
                        value={project.weddingTime}
                        onChange={(e) =>
                          setProject({
                            ...project,
                            weddingTime: e.target.value,
                          })
                        }
                        placeholder="07:15 PM (Shubh Muhurat)"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4AF37]/50 focus:outline-none focus:ring-2 focus:ring-[#5C0A1B] text-sm"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-[#5C0A1B] mb-1">
                        Wedding Venue Name *
                      </label>
                      <input
                        type="text"
                        value={project.weddingVenue}
                        onChange={(e) =>
                          setProject({
                            ...project,
                            weddingVenue: e.target.value,
                          })
                        }
                        placeholder="Suvarna Mahal, Rambagh Palace"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4AF37]/50 focus:outline-none focus:ring-2 focus:ring-[#5C0A1B] text-sm"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-[#5C0A1B] mb-1">
                        Full Venue Address *
                      </label>
                      <input
                        type="text"
                        value={project.weddingAddress}
                        onChange={(e) =>
                          setProject({
                            ...project,
                            weddingAddress: e.target.value,
                          })
                        }
                        placeholder="Bhawani Singh Road, Rambagh, Jaipur, Rajasthan"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4AF37]/50 focus:outline-none focus:ring-2 focus:ring-[#5C0A1B] text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#5C0A1B] mb-1">
                        Google Maps Location URL (Optional)
                      </label>
                      <input
                        type="url"
                        value={project.mapsUrl}
                        onChange={(e) =>
                          setProject({ ...project, mapsUrl: e.target.value })
                        }
                        placeholder="https://maps.google.com/?q=..."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4AF37]/40 focus:outline-none focus:ring-2 focus:ring-[#5C0A1B] text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#5C0A1B] mb-1">
                        RSVP Details (Optional)
                      </label>
                      <input
                        type="text"
                        value={project.rsvpDetails}
                        onChange={(e) =>
                          setProject({
                            ...project,
                            rsvpDetails: e.target.value,
                          })
                        }
                        placeholder="RSVP: Sharma & Singhania Family"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4AF37]/40 focus:outline-none focus:ring-2 focus:ring-[#5C0A1B] text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Additional Ceremonies Manager */}
                <div className="space-y-4 pt-4 border-t border-[#D4AF37]/30">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-bold font-royal text-[#5C0A1B] flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-[#5C0A1B] text-[#D4AF37] text-xs flex items-center justify-center">
                          3
                        </span>
                        Ceremony Events (Haldi, Mehndi, Sangeet, Reception)
                      </h3>
                      <p className="text-xs text-[#5C0A1B]/70 mt-0.5">
                        Only checked events are included in your video. Reorder
                        or add custom ceremonies anytime.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => addCustomEvent('custom')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#5C0A1B] text-[#FFFDF9] text-xs font-semibold hover:bg-[#82142B] transition"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#D4AF37]" />
                        Add Ceremony
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {project.events.map((evt, idx) => (
                      <div
                        key={evt.id}
                        className={`rounded-2xl p-4 border transition ${
                          evt.enabled
                            ? 'bg-[#FDF6EC] border-[#D4AF37]'
                            : 'bg-stone-50 border-stone-200 opacity-70'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <label className="flex items-center gap-2.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={evt.enabled}
                              onChange={(e) =>
                                updateEvent(evt.id, {
                                  enabled: e.target.checked,
                                })
                              }
                              className="w-4 h-4 rounded text-[#5C0A1B] focus:ring-[#5C0A1B]"
                            />
                            <span className="font-bold text-base text-[#5C0A1B] font-royal">
                              {evt.name || 'Ceremony Event'}
                            </span>
                            <span
                              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                evt.enabled
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-stone-200 text-stone-600'
                              }`}
                            >
                              {evt.enabled ? 'Included in Video' : 'Skipped'}
                            </span>
                          </label>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => moveEvent(idx, -1)}
                              disabled={idx === 0}
                              className="p-1.5 rounded-lg bg-white border border-stone-200 text-[#5C0A1B] disabled:opacity-35 hover:bg-amber-50"
                              title="Move Up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveEvent(idx, 1)}
                              disabled={idx === project.events.length - 1}
                              className="p-1.5 rounded-lg bg-white border border-stone-200 text-[#5C0A1B] disabled:opacity-35 hover:bg-amber-50"
                              title="Move Down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeEvent(evt.id)}
                              className="p-1.5 rounded-lg bg-white border border-red-200 text-red-600 hover:bg-red-50"
                              title="Remove Event"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {evt.enabled && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#D4AF37]/25">
                            <div>
                              <label className="block text-[11px] font-bold text-[#5C0A1B]/80 mb-0.5">
                                Ceremony Name
                              </label>
                              <input
                                type="text"
                                value={evt.name}
                                onChange={(e) =>
                                  updateEvent(evt.id, { name: e.target.value })
                                }
                                className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#D4AF37]/40 text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-[#5C0A1B]/80 mb-0.5">
                                Date
                              </label>
                              <input
                                type="date"
                                value={evt.date}
                                onChange={(e) =>
                                  updateEvent(evt.id, { date: e.target.value })
                                }
                                className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#D4AF37]/40 text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-[#5C0A1B]/80 mb-0.5">
                                Time
                              </label>
                              <input
                                type="text"
                                value={evt.time}
                                onChange={(e) =>
                                  updateEvent(evt.id, { time: e.target.value })
                                }
                                className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#D4AF37]/40 text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-[#5C0A1B]/80 mb-0.5">
                                Venue
                              </label>
                              <input
                                type="text"
                                value={evt.venue}
                                onChange={(e) =>
                                  updateEvent(evt.id, { venue: e.target.value })
                                }
                                className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#D4AF37]/40 text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-[#5C0A1B]/80 mb-0.5">
                                Address
                              </label>
                              <input
                                type="text"
                                value={evt.address}
                                onChange={(e) =>
                                  updateEvent(evt.id, {
                                    address: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#D4AF37]/40 text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-[#5C0A1B]/80 mb-0.5">
                                Dress Code / Note
                              </label>
                              <input
                                type="text"
                                value={evt.customMessage}
                                onChange={(e) =>
                                  updateEvent(evt.id, {
                                    customMessage: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#D4AF37]/40 text-xs"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: UPLOAD & CROP PHOTOS */}
            {step === 3 && (
              <div className="bg-white rounded-3xl p-6 sm:p-8 border-ornate space-y-6">
                <div className="border-b border-[#D4AF37]/30 pb-4">
                  <span className="text-xs font-bold uppercase tracking-widest text-[#9E7D1B]">
                    Step 3 of 4
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-bold font-royal text-[#5C0A1B]">
                    Upload &amp; Frame Couple Photographs
                  </h2>
                  <p className="text-xs sm:text-sm text-[#5C0A1B]/75 mt-1">
                    Upload JPG, PNG, or WebP images (up to 10MB). Use zoom and
                    pan sliders to position faces cleanly inside the royal frames.
                  </p>
                </div>

                <div className="space-y-4">
                  <PhotoUploaderCropper
                    label="1. Couple Portrait (Main Arch Frame)"
                    subtitle="Featured in Scene 3 (Couple Reveal) & Scene 8 (Wedding Mandap)"
                    slot={project.photos.couple}
                    archFrame
                    onChange={(couple) =>
                      setProject((p) => ({
                        ...p,
                        photos: { ...p.photos, couple },
                      }))
                    }
                  />

                  <PhotoUploaderCropper
                    label="2. Bride Portrait (Dulhan)"
                    subtitle="Featured in Scene 3 alongside the Groom portrait"
                    slot={project.photos.bride}
                    onChange={(bride) =>
                      setProject((p) => ({
                        ...p,
                        photos: { ...p.photos, bride },
                      }))
                    }
                  />

                  <PhotoUploaderCropper
                    label="3. Groom Portrait (Dulha)"
                    subtitle="Featured in Scene 3 alongside the Bride portrait"
                    slot={project.photos.groom}
                    onChange={(groom) =>
                      setProject((p) => ({
                        ...p,
                        photos: { ...p.photos, groom },
                      }))
                    }
                  />

                  <PhotoUploaderCropper
                    label="4. Pre-Wedding / Venue Photo (Optional)"
                    subtitle="Featured in Scene 9 (Closing RSVP & Thank-You)"
                    slot={
                      project.photos.gallery || {
                        url: '/samples/palace-sample.png',
                        zoom: 1,
                        offsetX: 0,
                        offsetY: 0,
                      }
                    }
                    onChange={(gallery) =>
                      setProject((p) => ({
                        ...p,
                        photos: { ...p.photos, gallery },
                      }))
                    }
                  />
                </div>

                {/* Mandatory User Consent Checkbox */}
                <div className="p-4 rounded-2xl bg-[#FDF6EC] border border-[#D4AF37]/50">
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={project.consentAccepted}
                      onChange={(e) =>
                        setProject((p) => ({
                          ...p,
                          consentAccepted: e.target.checked,
                        }))
                      }
                      className="mt-1 w-4 h-4 rounded text-[#5C0A1B] focus:ring-[#5C0A1B]"
                    />
                    <div className="text-xs text-[#5C0A1B] leading-relaxed">
                      <span className="font-bold">
                        Photo Processing &amp; Privacy Consent:
                      </span>{' '}
                      I confirm that I have permission to upload these photographs
                      for generating my wedding invitation video. Uploaded photos
                      are stored in private storage and temporary render files are
                      automatically cleaned up per policy.
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* STEP 4: MUSIC SELECTION & GENERATE MP4 */}
            {step === 4 && (
              <div className="bg-white rounded-3xl p-6 sm:p-8 border-ornate space-y-6">
                <div className="border-b border-[#D4AF37]/30 pb-4">
                  <span className="text-xs font-bold uppercase tracking-widest text-[#9E7D1B]">
                    Step 4 of 4
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-bold font-royal text-[#5C0A1B]">
                    Background Music &amp; Video Export
                  </h2>
                  <p className="text-xs sm:text-sm text-[#5C0A1B]/75 mt-1">
                    Select a royalty-free Indian wedding instrumental or upload
                    your own MP3/WAV song. We automatically add a 2s fade-in,
                    2.5s fade-out, and sync to your {Math.round(totalDurationSec)}s
                    video.
                  </p>
                </div>

                {/* Built-in Royalty-Free Wedding Music Library */}
                <div className="space-y-3">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#5C0A1B]">
                    Choose Royalty-Free Indian Wedding Music:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {musicTracks.map((track) => {
                      const selected = project.music.trackId === track.id;
                      return (
                        <div
                          key={track.id}
                          onClick={() => {
                            setProject((p) => ({
                              ...p,
                              music: {
                                ...p.music,
                                trackId: track.id,
                                title: track.title,
                                url: track.url,
                              },
                            }));
                            setIsPlayingAudio(false);
                          }}
                          className={`cursor-pointer p-3.5 rounded-2xl border transition flex flex-col justify-between ${
                            selected
                              ? 'bg-[#5C0A1B] text-[#FFFDF9] border-[#D4AF37] shadow-md'
                              : 'bg-[#FDF6EC] text-[#5C0A1B] border-[#D4AF37]/40 hover:border-[#5C0A1B]'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#D4AF37]/25 text-[#D4AF37]">
                                {track.category}
                              </span>
                              {selected && (
                                <Check className="w-4 h-4 text-[#D4AF37]" />
                              )}
                            </div>
                            <div className="font-bold text-sm mt-1.5">
                              {track.title}
                            </div>
                            <p
                              className={`text-[11px] mt-1 ${
                                selected
                                  ? 'text-[#F3E5AB]/85'
                                  : 'text-[#5C0A1B]/70'
                              }`}
                            >
                              {track.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Upload Custom MP3 / WAV Song */}
                <div className="p-4 rounded-2xl bg-[#FDF6EC] border border-[#D4AF37]/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-sm text-[#5C0A1B] flex items-center gap-1.5">
                      <Music className="w-4 h-4 text-[#D4AF37]" />
                      Or Upload Your Own Song (MP3 / WAV)
                    </h4>
                    <p className="text-xs text-[#5C0A1B]/70 mt-0.5">
                      Currently Active:{' '}
                      <strong className="text-[#5C0A1B]">
                        {project.music.title}
                      </strong>
                    </p>
                  </div>

                  <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#5C0A1B] hover:bg-[#82142B] text-[#FFFDF9] text-xs font-semibold transition shrink-0 shadow-sm">
                    <Upload className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>
                      {uploadingAudio ? 'Uploading Song...' : 'Upload MP3 / WAV'}
                    </span>
                    <input
                      type="file"
                      accept="audio/mpeg,audio/mp3,audio/wav,.mp3,.wav"
                      onChange={handleCustomAudioUpload}
                      disabled={uploadingAudio}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Audio Preview, Start Time Offset & Volume Controls */}
                <div className="p-4 rounded-2xl bg-white border border-[#D4AF37]/40 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-[#5C0A1B]">
                      Audio Timing &amp; Volume Controls
                    </div>
                    <button
                      type="button"
                      onClick={toggleAudioPreview}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#5C0A1B] text-[#F3E5AB] text-xs font-semibold hover:bg-[#82142B] transition"
                    >
                      {isPlayingAudio ? (
                        <>
                          <Pause className="w-3.5 h-3.5" /> Pause Audio Preview
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" /> Preview Selected Song
                        </>
                      )}
                    </button>
                    <audio
                      ref={audioPreviewRef}
                      src={project.music.url}
                      onEnded={() => setIsPlayingAudio(false)}
                      className="hidden"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="flex justify-between text-xs font-medium text-[#5C0A1B] mb-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-[#D4AF37]" /> Song
                          Start Position
                        </span>
                        <span>{project.music.startOffsetSec}s</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={45}
                        step={1}
                        value={project.music.startOffsetSec || 0}
                        onChange={(e) =>
                          setProject((p) => ({
                            ...p,
                            music: {
                              ...p.music,
                              startOffsetSec: parseInt(e.target.value, 10),
                            },
                          }))
                        }
                        className="w-full accent-[#5C0A1B] h-1.5 bg-amber-200 rounded-lg cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-medium text-[#5C0A1B] mb-1">
                        <span className="flex items-center gap-1">
                          <Volume2 className="w-3.5 h-3.5 text-[#D4AF37]" /> Music
                          Volume
                        </span>
                        <span>{Math.round((project.music.volume ?? 0.85) * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={0.1}
                        max={1}
                        step={0.05}
                        value={project.music.volume ?? 0.85}
                        onChange={(e) =>
                          setProject((p) => ({
                            ...p,
                            music: {
                              ...p.music,
                              volume: parseFloat(e.target.value),
                            },
                          }))
                        }
                        className="w-full accent-[#5C0A1B] h-1.5 bg-amber-200 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* Summary of Output Specs before Render */}
                <div className="p-4 rounded-2xl bg-[#3B0510] text-[#F3E5AB] border border-[#D4AF37]/50 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#F3E5AB]/75">Output Format:</span>
                    <span className="font-bold text-[#D4AF37]">
                      1080 × 1920 Vertical HD • 30 FPS • MP4 (H.264 + AAC)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#F3E5AB]/75">
                      Included Animated Scenes:
                    </span>
                    <span className="font-bold">
                      {scenes.length} Scenes (~{Math.round(totalDurationSec)}{' '}
                      Seconds)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#F3E5AB]/75">Couple:</span>
                    <span className="font-bold">
                      {project.brideName} &amp; {project.groomName}
                    </span>
                  </div>
                </div>

                {/* MAIN GENERATE VIDEO BUTTON */}
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleCreateWeddingVideo}
                  className="w-full py-4 px-6 rounded-2xl bg-gold-shimmer text-[#3B0510] font-bold text-lg shadow-xl hover:brightness-105 transition flex items-center justify-center gap-3 disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span>Starting HD MP4 Video Renderer...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-6 h-6" />
                      <span>Create My Wedding Video</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Wizard Bottom Navigation Buttons */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                disabled={step === 1}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-[#D4AF37]/50 text-[#5C0A1B] font-semibold text-sm disabled:opacity-40 hover:bg-amber-50 transition"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous Step
              </button>

              {step < 4 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.min(4, s + 1))}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#5C0A1B] text-[#FFFDF9] font-semibold text-sm hover:bg-[#82142B] transition shadow-md"
                >
                  <span>Next Step</span>
                  <ChevronRight className="w-4 h-4 text-[#D4AF37]" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleCreateWeddingVideo}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#5C0A1B] text-[#FFFDF9] font-semibold text-sm hover:bg-[#82142B] transition shadow-md"
                >
                  <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                  <span>Create My Wedding Video</span>
                </button>
              )}
            </div>
          </div>

          {/* RIGHT 5 COLUMNS: LIVE VERTICAL 9:16 REMOTION PLAYER */}
          <div className="lg:col-span-5 lg:sticky lg:top-20 bg-white rounded-3xl p-5 border-ornate flex flex-col items-center">
            <div className="w-full flex items-center justify-between mb-3 pb-2 border-b border-[#D4AF37]/30">
              <div>
                <h3 className="font-bold font-royal text-lg text-[#5C0A1B]">
                  Live 9:16 Vertical Preview
                </h3>
                <p className="text-[11px] text-[#5C0A1B]/70">
                  Updates instantly as you edit details, photos, or music
                </p>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-semibold">
                1080×1920
              </span>
            </div>

            <LiveRemotionPreview
              project={project}
              customTemplates={templates}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CreateInvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#FDF6EC] text-[#5C0A1B] font-semibold">
          Loading Wedding Invitation Studio...
        </div>
      }
    >
      <CreateInvitationWizardInner />
    </Suspense>
  );
}
