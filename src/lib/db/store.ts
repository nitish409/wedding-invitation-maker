import crypto from 'crypto';
import {
  MusicTrackItem,
  RenderJob,
  SystemSettings,
  TemplateDefinition,
  WeddingProject,
  WeddingProjectInput,
} from '@/types/wedding';
import {
  DEFAULT_MUSIC_TRACKS,
  DEFAULT_SYSTEM_SETTINGS,
  DEFAULT_TEMPLATES,
} from '@/lib/constants/templates';
import { createSignedToken } from '@/lib/security/tokens';
import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
  objectStorage,
} from '@/lib/storage/objectStorage';

interface DatabaseSchema {
  projects: WeddingProject[];
  renderJobs: RenderJob[];
  templates: TemplateDefinition[];
  musicTracks: MusicTrackItem[];
  settings: SystemSettings;
}

const DB_OBJECT_KEY = 'db-state.json';

// In-memory state mirror for fast reads between persistent flushes
let memoryDbCache: DatabaseSchema | null = null;

function createInitialDb(): DatabaseSchema {
  return {
    projects: [],
    renderJobs: [],
    templates: DEFAULT_TEMPLATES,
    musicTracks: DEFAULT_MUSIC_TRACKS,
    settings: DEFAULT_SYSTEM_SETTINGS,
  };
}

function normalizeDb(parsed: Partial<DatabaseSchema> | null): DatabaseSchema {
  if (!parsed) return createInitialDb();
  return {
    projects: Array.isArray(parsed.projects) ? parsed.projects : [],
    renderJobs: Array.isArray(parsed.renderJobs) ? parsed.renderJobs : [],
    templates:
      Array.isArray(parsed.templates) && parsed.templates.length > 0
        ? parsed.templates
        : DEFAULT_TEMPLATES,
    musicTracks:
      Array.isArray(parsed.musicTracks) && parsed.musicTracks.length > 0
        ? parsed.musicTracks
        : DEFAULT_MUSIC_TRACKS,
    settings: parsed.settings || DEFAULT_SYSTEM_SETTINGS,
  };
}

async function loadDb(): Promise<DatabaseSchema> {
  try {
    const rawBuf = await objectStorage.downloadObject('db', DB_OBJECT_KEY);
    if (rawBuf) {
      const parsed = JSON.parse(
        rawBuf.toString('utf-8')
      ) as Partial<DatabaseSchema>;
      memoryDbCache = normalizeDb(parsed);
      return memoryDbCache;
    }
  } catch {
    // Fallback to in-memory or initial DB if first boot
  }

  if (memoryDbCache) {
    return memoryDbCache;
  }

  const initial = createInitialDb();
  memoryDbCache = initial;
  try {
    await objectStorage.uploadObject(
      'db',
      DB_OBJECT_KEY,
      Buffer.from(JSON.stringify(initial, null, 2), 'utf-8'),
      'application/json'
    );
  } catch {
    // Ignore initial seed error if storage not ready
  }
  return initial;
}

async function saveDb(db: DatabaseSchema): Promise<void> {
  memoryDbCache = db;
  await objectStorage.uploadObject(
    'db',
    DB_OBJECT_KEY,
    Buffer.from(JSON.stringify(db, null, 2), 'utf-8'),
    'application/json'
  );
}

/**
 * Best-effort sync to Supabase PostgreSQL tables when configured & migrated.
 */
async function syncProjectToSupabaseTable(project: WeddingProject) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;
  try {
    await supabase.from('projects').upsert({
      id: project.id,
      slug: project.slug,
      template_id: project.templateId,
      language: project.language,
      bride_name: project.brideName,
      groom_name: project.groomName,
      bride_parents: project.brideParents,
      groom_parents: project.groomParents,
      family_message: project.familyMessage,
      hashtag: project.hashtag,
      contact_phone: project.contactPhone,
      wedding_date: project.weddingDate,
      wedding_time: project.weddingTime,
      wedding_venue: project.weddingVenue,
      wedding_address: project.weddingAddress,
      maps_url: project.mapsUrl,
      rsvp_details: project.rsvpDetails,
      events: project.events,
      photos: project.photos,
      music: project.music,
      consent_accepted: project.consentAccepted,
      is_public: project.isPublic ?? true,
      latest_job_id: project.latestJobId || null,
      rendered_video_url: project.renderedVideoUrl || null,
      created_at: project.createdAt,
      updated_at: project.updatedAt,
    });
  } catch {
    // Ignore if SQL migration hasn't been executed yet; objectStorage DB state handles persistence
  }
}

async function syncJobToSupabaseTable(job: RenderJob) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;
  try {
    await supabase.from('render_jobs').upsert({
      id: job.id,
      project_id: job.projectId,
      status: job.status,
      progress: job.progress,
      stage_message: job.stageMessage,
      output_path: job.outputPath || null,
      output_size_bytes: job.outputSizeBytes || null,
      duration_sec: job.durationSec || null,
      resolution: job.resolution,
      fps: job.fps,
      attempts: job.attempts,
      error_message: job.errorMessage || null,
      expires_at: job.expiresAt || null,
      created_at: job.createdAt,
      updated_at: job.updatedAt,
      completed_at: job.completedAt || null,
    });
  } catch {
    // Ignore if SQL migration hasn't been executed yet
  }
}

function generateSlug(brideName: string, groomName: string): string {
  const clean = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'wedding';
  const shortId = crypto.randomBytes(3).toString('hex');
  return `${clean(brideName)}-weds-${clean(groomName)}-${shortId}`;
}

export const dbStore = {
  // Projects
  async createProject(input: WeddingProjectInput): Promise<WeddingProject> {
    const db = await loadDb();
    const now = new Date().toISOString();
    const project: WeddingProject = {
      ...input,
      id: crypto.randomUUID(),
      slug: generateSlug(input.brideName, input.groomName),
      isPublic: input.isPublic ?? true,
      createdAt: now,
      updatedAt: now,
    };
    db.projects.unshift(project);
    await saveDb(db);
    await syncProjectToSupabaseTable(project);
    return project;
  },

  async updateProject(
    id: string,
    patch: Partial<WeddingProject>
  ): Promise<WeddingProject | null> {
    const db = await loadDb();
    const idx = db.projects.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    db.projects[idx] = {
      ...db.projects[idx],
      ...patch,
      id: db.projects[idx].id,
      updatedAt: new Date().toISOString(),
    };
    await saveDb(db);
    await syncProjectToSupabaseTable(db.projects[idx]);
    return db.projects[idx];
  },

  async getProjectById(id: string): Promise<WeddingProject | null> {
    const db = await loadDb();
    return db.projects.find((p) => p.id === id) || null;
  },

  async getProjectBySlug(slug: string): Promise<WeddingProject | null> {
    const db = await loadDb();
    return db.projects.find((p) => p.slug === slug || p.id === slug) || null;
  },

  async listProjects(): Promise<WeddingProject[]> {
    const db = await loadDb();
    return db.projects;
  },

  // Render Jobs
  async createRenderJob(projectId: string): Promise<RenderJob> {
    const db = await loadDb();
    const settings = db.settings || DEFAULT_SYSTEM_SETTINGS;
    const now = new Date().toISOString();
    const jobId = crypto.randomUUID();
    const expiresAt = new Date(
      Date.now() + settings.linkExpiryHours * 3600 * 1000
    ).toISOString();
    const downloadToken = createSignedToken(
      jobId,
      'video',
      settings.linkExpiryHours
    );

    const job: RenderJob = {
      id: jobId,
      projectId,
      status: 'queued',
      progress: 2,
      stageMessage: 'Validating project & initializing render pipeline...',
      resolution: `${settings.resolutionWidth}x${settings.resolutionHeight}`,
      fps: settings.fps,
      attempts: 1,
      expiresAt,
      downloadToken,
      createdAt: now,
      updatedAt: now,
    };

    db.renderJobs.unshift(job);
    const pIdx = db.projects.findIndex((p) => p.id === projectId);
    if (pIdx !== -1) {
      db.projects[pIdx].latestJobId = job.id;
      db.projects[pIdx].updatedAt = now;
      await syncProjectToSupabaseTable(db.projects[pIdx]);
    }
    await saveDb(db);
    await syncJobToSupabaseTable(job);
    return job;
  },

  async updateRenderJob(
    id: string,
    patch: Partial<RenderJob>
  ): Promise<RenderJob | null> {
    const db = await loadDb();
    const idx = db.renderJobs.findIndex((j) => j.id === id);
    if (idx === -1) return null;
    const now = new Date().toISOString();
    db.renderJobs[idx] = {
      ...db.renderJobs[idx],
      ...patch,
      updatedAt: now,
    };
    const updatedJob = db.renderJobs[idx];

    if (patch.status === 'completed' && updatedJob.downloadToken) {
      const pIdx = db.projects.findIndex((p) => p.id === updatedJob.projectId);
      if (pIdx !== -1) {
        db.projects[pIdx].renderedVideoUrl = `/api/download/${updatedJob.id}?token=${encodeURIComponent(
          updatedJob.downloadToken
        )}`;
        db.projects[pIdx].updatedAt = now;
        await syncProjectToSupabaseTable(db.projects[pIdx]);
      }
    }

    await saveDb(db);
    await syncJobToSupabaseTable(updatedJob);
    return updatedJob;
  },

  async getRenderJobById(id: string): Promise<RenderJob | null> {
    const db = await loadDb();
    return db.renderJobs.find((j) => j.id === id) || null;
  },

  async listRenderJobs(): Promise<RenderJob[]> {
    const db = await loadDb();
    return db.renderJobs;
  },

  // Templates & Music
  async listTemplates(includeDisabled = false): Promise<TemplateDefinition[]> {
    const db = await loadDb();
    return includeDisabled
      ? db.templates
      : db.templates.filter((t) => t.enabled);
  },

  async upsertTemplate(
    template: TemplateDefinition
  ): Promise<TemplateDefinition[]> {
    const db = await loadDb();
    const idx = db.templates.findIndex((t) => t.id === template.id);
    if (idx >= 0) {
      db.templates[idx] = template;
    } else {
      db.templates.push(template);
    }
    await saveDb(db);
    return db.templates;
  },

  async toggleTemplate(
    id: string,
    enabled: boolean
  ): Promise<TemplateDefinition | null> {
    const db = await loadDb();
    const idx = db.templates.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    db.templates[idx].enabled = enabled;
    await saveDb(db);
    return db.templates[idx];
  },

  async listMusicTracks(includeDisabled = false): Promise<MusicTrackItem[]> {
    const db = await loadDb();
    return includeDisabled
      ? db.musicTracks
      : db.musicTracks.filter((t) => t.enabled);
  },

  async addMusicTrack(track: MusicTrackItem): Promise<MusicTrackItem[]> {
    const db = await loadDb();
    const idx = db.musicTracks.findIndex((t) => t.id === track.id);
    if (idx >= 0) {
      db.musicTracks[idx] = track;
    } else {
      db.musicTracks.push(track);
    }
    await saveDb(db);
    return db.musicTracks;
  },

  async toggleMusicTrack(
    id: string,
    enabled: boolean
  ): Promise<MusicTrackItem | null> {
    const db = await loadDb();
    const idx = db.musicTracks.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    db.musicTracks[idx].enabled = enabled;
    await saveDb(db);
    return db.musicTracks[idx];
  },

  async getSettings(): Promise<SystemSettings> {
    const db = await loadDb();
    return db.settings;
  },

  async updateSettings(
    patch: Partial<SystemSettings>
  ): Promise<SystemSettings> {
    const db = await loadDb();
    db.settings = {
      ...db.settings,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await saveDb(db);
    return db.settings;
  },

  // Storage & Usage Metrics + Temp File Cleanup
  async getUsageStats() {
    const db = await loadDb();
    const [photosList, audioList, rendersList] = await Promise.all([
      objectStorage.listObjects('photos'),
      objectStorage.listObjects('audio'),
      objectStorage.listObjects('renders'),
    ]);

    const sumBytes = (items: Array<{ sizeBytes: number }>) =>
      items.reduce((acc, item) => acc + (item.sizeBytes || 0), 0);

    const photosBytes = sumBytes(photosList);
    const audioBytes = sumBytes(audioList);
    const rendersBytes = sumBytes(rendersList);

    const completedJobs = db.renderJobs.filter(
      (j) => j.status === 'completed'
    ).length;
    const failedJobs = db.renderJobs.filter(
      (j) => j.status === 'failed'
    ).length;
    const activeJobs = db.renderJobs.filter(
      (j) => j.status === 'queued' || j.status === 'processing'
    ).length;

    return {
      totalProjects: db.projects.length,
      totalJobs: db.renderJobs.length,
      completedJobs,
      failedJobs,
      activeJobs,
      storageBackend: isSupabaseConfigured() ? 'supabase' : 'local',
      storage: {
        photosCount: photosList.length,
        photosBytes,
        audioCount: audioList.length,
        audioBytes,
        rendersCount: rendersList.length,
        rendersBytes,
        totalBytes: photosBytes + audioBytes + rendersBytes,
      },
    };
  },

  async cleanupExpiredFiles(): Promise<{ deletedFiles: number }> {
    const db = await loadDb();
    const now = Date.now();
    let deletedFiles = 0;

    for (const job of db.renderJobs) {
      if (
        job.expiresAt &&
        new Date(job.expiresAt).getTime() < now &&
        job.outputPath
      ) {
        const removed = await objectStorage.deleteObject(
          'renders',
          job.outputPath
        );
        if (removed) deletedFiles++;
      }
    }

    return { deletedFiles };
  },
};
