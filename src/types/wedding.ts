export type TemplateId =
  | 'royal-wedding'
  | 'floral-wedding'
  | 'haldi-mehndi'
  | 'traditional-indian'
  | string;

export type LanguageMode = 'english' | 'hindi' | 'mixed';

export type CeremonyType =
  | 'haldi'
  | 'mehndi'
  | 'sangeet'
  | 'engagement'
  | 'wedding'
  | 'reception'
  | 'custom';

export interface CeremonyEvent {
  id: string;
  type: CeremonyType;
  name: string;
  enabled: boolean;
  date: string;
  time: string;
  venue: string;
  address: string;
  customMessage: string;
}

export interface PhotoSlotConfig {
  url: string;
  zoom: number; // 1.0 to 2.5
  offsetX: number; // -100 to 100 percentage pan
  offsetY: number; // -100 to 100 percentage pan
  removeBg?: boolean; // Optional studio halo/cutout mask mode
  caption?: string;
}

export interface WeddingPhotos {
  bride: PhotoSlotConfig;
  groom: PhotoSlotConfig;
  couple: PhotoSlotConfig;
  gallery?: PhotoSlotConfig;
}

export interface MusicConfig {
  trackId: string;
  title: string;
  url: string;
  startOffsetSec: number;
  volume: number; // 0 to 1
}

export interface WeddingProjectInput {
  templateId: TemplateId;
  language: LanguageMode;
  brideName: string;
  groomName: string;
  brideParents: string;
  groomParents: string;
  familyMessage: string;
  hashtag: string;
  contactPhone: string;
  weddingDate: string;
  weddingTime: string;
  weddingVenue: string;
  weddingAddress: string;
  mapsUrl: string;
  rsvpDetails: string;
  events: CeremonyEvent[];
  photos: WeddingPhotos;
  music: MusicConfig;
  consentAccepted: boolean;
  isPublic?: boolean;
}

export interface WeddingProject extends WeddingProjectInput {
  id: string;
  slug: string;
  latestJobId?: string;
  renderedVideoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export type RenderJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface RenderJob {
  id: string;
  projectId: string;
  status: RenderJobStatus;
  progress: number;
  stageMessage: string;
  outputPath?: string;
  outputSizeBytes?: number;
  durationSec?: number;
  resolution: string;
  fps: number;
  attempts: number;
  errorMessage?: string;
  expiresAt?: string;
  downloadToken?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface TemplateDefinition {
  id: TemplateId;
  name: string;
  nameHindi: string;
  subtitle: string;
  description: string;
  enabled: boolean;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  bgColor: string;
  bgGradientEnd: string;
  textColor: string;
  mutedTextColor: string;
  defaultMusicId: string;
  previewBadge: string;
  features: string[];
  motifStyle: 'mandala' | 'floral-arch' | 'marigold' | 'peacock-mandap';
}

export interface MusicTrackItem {
  id: string;
  title: string;
  artist: string;
  category: string;
  durationSec: number;
  url: string;
  isDefault: boolean;
  enabled: boolean;
  description: string;
}

export interface SystemSettings {
  resolutionWidth: number;
  resolutionHeight: number;
  fps: number;
  linkExpiryHours: number;
  autoDeleteTempHours: number;
  maxRendersPerIpHour: number;
  updatedAt: string;
}

export interface ComputedScene {
  id: string;
  kind:
    | 'ganesh'
    | 'title'
    | 'couple'
    | 'family'
    | 'ceremony'
    | 'wedding-main'
    | 'closing';
  title: string;
  subtitle?: string;
  durationSec: number;
  startFrame: number;
  durationFrames: number;
  ceremony?: CeremonyEvent;
}
