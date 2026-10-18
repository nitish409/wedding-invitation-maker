import fs from 'fs';
import path from 'path';
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

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
export const STORAGE_DIRS = {
  photos: path.join(DATA_DIR, 'storage', 'photos'),
  audio: path.join(DATA_DIR, 'storage', 'audio'),
  renders: path.join(DATA_DIR, 'storage', 'renders'),
};

interface DatabaseSchema {
  projects: WeddingProject[];
  renderJobs: RenderJob[];
  templates: TemplateDefinition[];
  musicTracks: MusicTrackItem[];
  settings: SystemSettings;
}

function ensureDirectories() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(STORAGE_DIRS.photos, { recursive: true });
  fs.mkdirSync(STORAGE_DIRS.audio, { recursive: true });
  fs.mkdirSync(STORAGE_DIRS.renders, { recursive: true });
}

function loadDb(): DatabaseSchema {
  ensureDirectories();
  if (!fs.existsSync(DB_FILE)) {
    const initial: DatabaseSchema = {
      projects: [],
      renderJobs: [],
      templates: DEFAULT_TEMPLATES,
      musicTracks: DEFAULT_MUSIC_TRACKS,
      settings: DEFAULT_SYSTEM_SETTINGS,
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<DatabaseSchema>;
    return {
      projects: parsed.projects || [],
      renderJobs: parsed.renderJobs || [],
      templates:
        parsed.templates && parsed.templates.length > 0
          ? parsed.templates
          : DEFAULT_TEMPLATES,
      musicTracks:
        parsed.musicTracks && parsed.musicTracks.length > 0
          ? parsed.musicTracks
          : DEFAULT_MUSIC_TRACKS,
      settings: parsed.settings || DEFAULT_SYSTEM_SETTINGS,
    };
  } catch {
    return {
      projects: [],
      renderJobs: [],
      templates: DEFAULT_TEMPLATES,
      musicTracks: DEFAULT_MUSIC_TRACKS,
      settings: DEFAULT_SYSTEM_SETTINGS,
    };
  }
}

function saveDb(db: DatabaseSchema) {
  ensureDirectories();
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DB_FILE);
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
  createProject(input: WeddingProjectInput): WeddingProject {
    const db = loadDb();
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
    saveDb(db);
    return project;
  },

  updateProject(
    id: string,
    patch: Partial<WeddingProject>
  ): WeddingProject | null {
    const db = loadDb();
    const idx = db.projects.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    db.projects[idx] = {
      ...db.projects[idx],
      ...patch,
      id: db.projects[idx].id,
      updatedAt: new Date().toISOString(),
    };
    saveDb(db);
    return db.projects[idx];
  },

  getProjectById(id: string): WeddingProject | null {
    const db = loadDb();
    return db.projects.find((p) => p.id === id) || null;
  },

  getProjectBySlug(slug: string): WeddingProject | null {
    const db = loadDb();
    return db.projects.find((p) => p.slug === slug || p.id === slug) || null;
  },

  listProjects(): WeddingProject[] {
    return loadDb().projects;
  },

  // Render Jobs
  createRenderJob(projectId: string): RenderJob {
    const db = loadDb();
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
    }
    saveDb(db);
    return job;
  },

  updateRenderJob(id: string, patch: Partial<RenderJob>): RenderJob | null {
    const db = loadDb();
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
      }
    }

    saveDb(db);
    return updatedJob;
  },

  getRenderJobById(id: string): RenderJob | null {
    return loadDb().renderJobs.find((j) => j.id === id) || null;
  },

  listRenderJobs(): RenderJob[] {
    return loadDb().renderJobs;
  },

  // Templates & Music
  listTemplates(includeDisabled = false): TemplateDefinition[] {
    const templates = loadDb().templates;
    return includeDisabled ? templates : templates.filter((t) => t.enabled);
  },

  upsertTemplate(template: TemplateDefinition): TemplateDefinition[] {
    const db = loadDb();
    const idx = db.templates.findIndex((t) => t.id === template.id);
    if (idx >= 0) {
      db.templates[idx] = template;
    } else {
      db.templates.push(template);
    }
    saveDb(db);
    return db.templates;
  },

  toggleTemplate(id: string, enabled: boolean): TemplateDefinition | null {
    const db = loadDb();
    const idx = db.templates.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    db.templates[idx].enabled = enabled;
    saveDb(db);
    return db.templates[idx];
  },

  listMusicTracks(includeDisabled = false): MusicTrackItem[] {
    const tracks = loadDb().musicTracks;
    return includeDisabled ? tracks : tracks.filter((t) => t.enabled);
  },

  addMusicTrack(track: MusicTrackItem): MusicTrackItem[] {
    const db = loadDb();
    const idx = db.musicTracks.findIndex((t) => t.id === track.id);
    if (idx >= 0) {
      db.musicTracks[idx] = track;
    } else {
      db.musicTracks.push(track);
    }
    saveDb(db);
    return db.musicTracks;
  },

  toggleMusicTrack(id: string, enabled: boolean): MusicTrackItem | null {
    const db = loadDb();
    const idx = db.musicTracks.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    db.musicTracks[idx].enabled = enabled;
    saveDb(db);
    return db.musicTracks[idx];
  },

  getSettings(): SystemSettings {
    return loadDb().settings;
  },

  updateSettings(patch: Partial<SystemSettings>): SystemSettings {
    const db = loadDb();
    db.settings = {
      ...db.settings,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    saveDb(db);
    return db.settings;
  },

  // Storage & Usage Metrics + Temp File Cleanup
  getUsageStats() {
    ensureDirectories();
    const db = loadDb();
    const calcDirSize = (dir: string) => {
      if (!fs.existsSync(dir)) return { count: 0, bytes: 0 };
      const files = fs.readdirSync(dir);
      let bytes = 0;
      for (const f of files) {
        try {
          const st = fs.statSync(path.join(dir, f));
          if (st.isFile()) bytes += st.size;
        } catch {
          // ignore
        }
      }
      return { count: files.length, bytes };
    };

    const photosStat = calcDirSize(STORAGE_DIRS.photos);
    const audioStat = calcDirSize(STORAGE_DIRS.audio);
    const rendersStat = calcDirSize(STORAGE_DIRS.renders);

    const completedJobs = db.renderJobs.filter((j) => j.status === 'completed').length;
    const failedJobs = db.renderJobs.filter((j) => j.status === 'failed').length;
    const activeJobs = db.renderJobs.filter(
      (j) => j.status === 'queued' || j.status === 'processing'
    ).length;

    return {
      totalProjects: db.projects.length,
      totalJobs: db.renderJobs.length,
      completedJobs,
      failedJobs,
      activeJobs,
      storage: {
        photosCount: photosStat.count,
        photosBytes: photosStat.bytes,
        audioCount: audioStat.count,
        audioBytes: audioStat.bytes,
        rendersCount: rendersStat.count,
        rendersBytes: rendersStat.bytes,
        totalBytes: photosStat.bytes + audioStat.bytes + rendersStat.bytes,
      },
    };
  },

  cleanupExpiredFiles(): { deletedFiles: number } {
    ensureDirectories();
    const db = loadDb();
    const maxAgeMs = (db.settings.autoDeleteTempHours || 24) * 3600 * 1000;
    const now = Date.now();
    let deletedFiles = 0;

    for (const job of db.renderJobs) {
      if (
        job.expiresAt &&
        new Date(job.expiresAt).getTime() < now &&
        job.outputPath &&
        fs.existsSync(job.outputPath)
      ) {
        try {
          fs.unlinkSync(job.outputPath);
          deletedFiles++;
        } catch {
          // ignore
        }
      }
    }

    // Also clean orphan temp files older than maxAgeMs
    const rendersFiles = fs.readdirSync(STORAGE_DIRS.renders);
    for (const f of rendersFiles) {
      if (f.endsWith('.tmp.mp4')) {
        const full = path.join(STORAGE_DIRS.renders, f);
        try {
          const st = fs.statSync(full);
          if (now - st.mtimeMs > maxAgeMs) {
            fs.unlinkSync(full);
            deletedFiles++;
          }
        } catch {
          // ignore
        }
      }
    }

    return { deletedFiles };
  },
};
