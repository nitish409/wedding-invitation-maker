import {
  CeremonyEvent,
  ComputedScene,
  LanguageMode,
  TemplateDefinition,
  WeddingProjectInput,
} from '@/types/wedding';
import { DEFAULT_TEMPLATES } from '@/lib/constants/templates';

export interface LocalizedLabels {
  invocation: string;
  invocationSub: string;
  titleMain: string;
  titleSub: string;
  wedsLabel: string;
  daughterOf: string;
  sonOf: string;
  familyHeader: string;
  ceremonyHeader: string;
  weddingHeader: string;
  weddingSub: string;
  venueLabel: string;
  dateTimeLabel: string;
  closingHeader: string;
  closingMessage: string;
  rsvpHeader: string;
}

export function getLocalizedCopy(lang: LanguageMode): LocalizedLabels {
  if (lang === 'hindi') {
    return {
      invocation: '॥ श्री गणेशाय नमः ॥',
      invocationSub: 'वक्रतुण्ड महाकाय सूर्यकोटि समप्रभ। निर्विघ्नं कुरु मे देव सर्वकार्येषु सर्वदा॥',
      titleMain: 'शुभ विवाह निमंत्रण',
      titleSub: 'मंगल परिणय उत्सव में आपका हार्दिक स्वागत है',
      wedsLabel: 'संग',
      daughterOf: 'सुपुत्री:',
      sonOf: 'सुपुत्र:',
      familyHeader: 'स्नेहिल पारिवारिक निमंत्रण',
      ceremonyHeader: 'मांगलिक कार्यक्रम',
      weddingHeader: 'शुभ विवाह मुहूर्त एवं स्थल',
      weddingSub: 'पाणिग्रहण संस्कार',
      venueLabel: 'विवाह स्थल:',
      dateTimeLabel: 'दिनांक एवं शुभ समय:',
      closingHeader: 'आपकी उपस्थिति हमारी खुशी है',
      closingMessage: 'नवयुगल को आशीर्वाद देने हेतु सपरिवार पधारें • सादर धन्यवाद',
      rsvpHeader: 'दर्शनाभिलाषी एवं विनीत',
    };
  }

  if (lang === 'mixed') {
    return {
      invocation: '॥ श्री गणेशाय नमः ॥',
      invocationSub: 'Om Shri Ganeshaya Namah • Auspicious Beginnings',
      titleMain: 'Shubh Vivah • शुभ विवाह',
      titleSub: 'A Royal Celebration of Love & Sacred Union',
      wedsLabel: 'Weds • संग',
      daughterOf: 'Beloved Daughter of',
      sonOf: 'Beloved Son of',
      familyHeader: 'Family Blessings • स्नेहिल निमंत्रण',
      ceremonyHeader: 'Wedding Celebrations • मांगलिक कार्यक्रम',
      weddingHeader: 'The Sacred Wedding • शुभ विवाह',
      weddingSub: 'Pheras & Auspicious Muhurat',
      venueLabel: 'Royal Venue',
      dateTimeLabel: 'Date & Auspicious Time',
      closingHeader: 'Await Your Gracious Presence • सादर आमंत्रण',
      closingMessage: 'With Warm Regards & Best Compliments From Both Families',
      rsvpHeader: 'RSVP & Warm Welcomes',
    };
  }

  return {
    invocation: 'Om Shri Ganeshaya Namah',
    invocationSub: 'With Divine Blessings of Lord Ganesha',
    titleMain: 'Wedding Invitation',
    titleSub: 'Together With Their Families, Joyfully Invite You',
    wedsLabel: 'Weds',
    daughterOf: 'Beloved Daughter of',
    sonOf: 'Beloved Son of',
    familyHeader: 'Cordial Family Invitation',
    ceremonyHeader: 'Auspicious Ceremonies',
    weddingHeader: 'The Wedding Ceremony',
    weddingSub: 'Sacred Union & Wedding Vows',
    venueLabel: 'Venue',
    dateTimeLabel: 'Date & Time',
    closingHeader: 'We Await Your Gracious Presence',
    closingMessage: 'Your blessings and presence are the greatest gift to the couple.',
    rsvpHeader: 'RSVP & Compliments',
  };
}

export function getTemplateById(
  templateId: string,
  customTemplates: TemplateDefinition[] = DEFAULT_TEMPLATES
): TemplateDefinition {
  return (
    customTemplates.find((t) => t.id === templateId) ||
    DEFAULT_TEMPLATES.find((t) => t.id === templateId) ||
    DEFAULT_TEMPLATES[0]
  );
}

export function formatReadableDate(dateStr: string): string {
  if (!dateStr) return '12 December 2026';
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Calculates the dynamic 9-scene sequence, skipping unused ceremonies
 * and normalizing total video duration into the 45–65 second window.
 */
export function calculateWeddingScenes(
  project: WeddingProjectInput,
  fps: number = 30
): {
  scenes: ComputedScene[];
  totalDurationSec: number;
  totalFrames: number;
} {
  const enabledEvents: CeremonyEvent[] = (project.events || []).filter((e) => e.enabled);
  const copy = getLocalizedCopy(project.language);

  const rawScenes: Array<{
    id: string;
    kind: ComputedScene['kind'];
    title: string;
    subtitle?: string;
    baseDurationSec: number;
    ceremony?: CeremonyEvent;
  }> = [
    {
      id: 'scene-ganesh',
      kind: 'ganesh',
      title: copy.invocation,
      subtitle: copy.invocationSub,
      baseDurationSec: 5.5,
    },
    {
      id: 'scene-title',
      kind: 'title',
      title: copy.titleMain,
      subtitle: copy.titleSub,
      baseDurationSec: 5.5,
    },
    {
      id: 'scene-couple',
      kind: 'couple',
      title: `${project.brideName} & ${project.groomName}`,
      subtitle: project.hashtag || copy.wedsLabel,
      baseDurationSec: 7.5,
    },
    {
      id: 'scene-family',
      kind: 'family',
      title: copy.familyHeader,
      subtitle: project.familyMessage,
      baseDurationSec: 6.5,
    },
  ];

  // Scenes 5..N: Only selected ceremonies in user's exact order
  enabledEvents.forEach((evt, index) => {
    rawScenes.push({
      id: `scene-ceremony-${evt.id || index}`,
      kind: 'ceremony',
      title: evt.name,
      subtitle: `${formatReadableDate(evt.date)} • ${evt.time}`,
      baseDurationSec: 6.0,
      ceremony: evt,
    });
  });

  // Scene 8: Main Wedding Date, Time, Venue & Mandap
  rawScenes.push({
    id: 'scene-wedding-main',
    kind: 'wedding-main',
    title: copy.weddingHeader,
    subtitle: `${formatReadableDate(project.weddingDate)} • ${project.weddingTime}`,
    baseDurationSec: 8.0,
  });

  // Scene 9: Final Invitation Message, Family Names & Thank You
  rawScenes.push({
    id: 'scene-closing',
    kind: 'closing',
    title: copy.closingHeader,
    subtitle: copy.closingMessage,
    baseDurationSec: 6.5,
  });

  // Normalize total duration into 45s - 65s window
  const rawTotalSec = rawScenes.reduce((acc, s) => acc + s.baseDurationSec, 0);
  let targetTotalSec = rawTotalSec;
  if (rawTotalSec < 45) {
    targetTotalSec = 46;
  } else if (rawTotalSec > 65) {
    targetTotalSec = 64;
  }

  const scaleFactor = targetTotalSec / rawTotalSec;
  let currentFrame = 0;

  const scenes: ComputedScene[] = rawScenes.map((s) => {
    const durationSec = Number((s.baseDurationSec * scaleFactor).toFixed(2));
    const durationFrames = Math.max(fps * 3, Math.round(durationSec * fps));
    const computed: ComputedScene = {
      id: s.id,
      kind: s.kind,
      title: s.title,
      subtitle: s.subtitle,
      durationSec: durationFrames / fps,
      startFrame: currentFrame,
      durationFrames,
      ceremony: s.ceremony,
    };
    currentFrame += durationFrames;
    return computed;
  });

  return {
    scenes,
    totalDurationSec: Number((currentFrame / fps).toFixed(2)),
    totalFrames: currentFrame,
  };
}
