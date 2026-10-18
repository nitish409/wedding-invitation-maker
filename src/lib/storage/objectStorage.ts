import fs from 'fs';
import os from 'os';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type StorageBucketKind = 'photos' | 'audio' | 'renders' | 'db';

const BUCKET_MAP: Record<StorageBucketKind, string> = {
  photos: process.env.SUPABASE_PHOTOS_BUCKET || 'private-photos',
  audio: process.env.SUPABASE_AUDIO_BUCKET || 'custom-audio',
  renders: process.env.SUPABASE_RENDERS_BUCKET || 'rendered-videos',
  db: process.env.SUPABASE_DB_BUCKET || 'private-photos',
};

export function isServerlessEnvironment(): boolean {
  return Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.NETLIFY ||
      process.cwd().startsWith('/var/task')
  );
}

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(
    url &&
      key &&
      url.startsWith('http') &&
      !url.includes('your-project-id.supabase.co')
  );
}

let supabaseClientInstance: SupabaseClient | null = null;
const initializedBuckets = new Set<string>();

export function getSupabaseAdminClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (supabaseClientInstance) return supabaseClientInstance;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;

  supabaseClientInstance = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return supabaseClientInstance;
}

async function ensureSupabaseBucket(
  client: SupabaseClient,
  bucketName: string
): Promise<void> {
  if (initializedBuckets.has(bucketName)) return;
  try {
    const { data: existing, error: getErr } =
      await client.storage.getBucket(bucketName);
    if (!existing && getErr) {
      await client.storage.createBucket(bucketName, {
        public: false,
      });
    }
    initializedBuckets.add(bucketName);
  } catch {
    // If using anon key without bucket-creation permission, assume bucket exists
    initializedBuckets.add(bucketName);
  }
}

/**
 * Resolves a writable root directory ONLY for non-serverless local development
 * or temporary fallback. NEVER returns /var/task or a read-only directory.
 */
function getWritableLocalRoot(): string {
  if (!isServerlessEnvironment()) {
    // Local machine development: store in ~/.shubhvivah-studio-data so it survives server restarts
    // and never pollutes or fails on read-only mounts
    const homeStore = path.join(os.homedir(), '.shubhvivah-studio-data');
    try {
      fs.mkdirSync(homeStore, { recursive: true });
      return homeStore;
    } catch {
      // Fallback to os.tmpdir() if homedir is restricted
    }
  }
  const tmpStore = path.join(os.tmpdir(), 'shubhvivah-studio-storage');
  fs.mkdirSync(tmpStore, { recursive: true });
  return tmpStore;
}

function getLocalBucketDir(kind: StorageBucketKind): string {
  const root = getWritableLocalRoot();
  const dir = path.join(root, kind);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// In-memory LRU cache so hot reads in the same process are instant
const memoryObjectCache = new Map<string, Buffer>();
const MAX_CACHE_ITEMS = 40;

function cacheBuffer(cacheKey: string, buf: Buffer) {
  if (buf.length > 35 * 1024 * 1024) return; // Don't cache huge files in RAM
  if (memoryObjectCache.size >= MAX_CACHE_ITEMS) {
    const firstKey = memoryObjectCache.keys().next().value;
    if (firstKey) memoryObjectCache.delete(firstKey);
  }
  memoryObjectCache.set(cacheKey, buf);
}

export const objectStorage = {
  /**
   * Uploads a binary object (photo, audio, rendered MP4, or DB snapshot)
   * to Supabase Storage (when configured) and/or writable local storage.
   */
  async uploadObject(
    kind: StorageBucketKind,
    key: string,
    buffer: Buffer,
    contentType: string
  ): Promise<{
    storageKey: string;
    sizeBytes: number;
    backend: 'supabase' | 'local';
  }> {
    const safeKey = path.basename(key);
    const cacheKey = `${kind}:${safeKey}`;
    cacheBuffer(cacheKey, buffer);

    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const bucketName = BUCKET_MAP[kind];
      await ensureSupabaseBucket(supabase, bucketName);
      const objectPath = kind === 'db' ? `__db/${safeKey}` : safeKey;

      const { error } = await supabase.storage
        .from(bucketName)
        .upload(objectPath, buffer, {
          contentType,
          upsert: true,
        });

      if (error) {
        throw new Error(
          `Supabase Storage upload failed for ${bucketName}/${objectPath}: ${error.message}`
        );
      }

      // Also write to writable local cache dir if available so FFmpeg/local reads are fast
      try {
        const localDir = getLocalBucketDir(kind);
        fs.writeFileSync(path.join(localDir, safeKey), buffer);
      } catch {
        // Ignore local cache write errors
      }

      return {
        storageKey: safeKey,
        sizeBytes: buffer.length,
        backend: 'supabase',
      };
    }

    // If require_supabase is strictly enforced in production
    if (process.env.REQUIRE_SUPABASE_STORAGE === 'true') {
      throw new Error(
        'Supabase Storage is required but NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not configured.'
      );
    }

    const localDir = getLocalBucketDir(kind);
    const fullPath = path.join(localDir, safeKey);
    fs.writeFileSync(fullPath, buffer);

    return {
      storageKey: safeKey,
      sizeBytes: buffer.length,
      backend: 'local',
    };
  },

  /**
   * Downloads a binary object by kind & key from memory cache, writable local cache, or Supabase Storage.
   */
  async downloadObject(
    kind: StorageBucketKind,
    key: string
  ): Promise<Buffer | null> {
    const safeKey = path.basename(key);
    const cacheKey = `${kind}:${safeKey}`;

    if (kind !== 'db' && memoryObjectCache.has(cacheKey)) {
      return memoryObjectCache.get(cacheKey)!;
    }

    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const bucketName = BUCKET_MAP[kind];
      const objectPath = kind === 'db' ? `__db/${safeKey}` : safeKey;
      const { data, error } = await supabase.storage
        .from(bucketName)
        .download(objectPath);

      if (!error && data) {
        const arrayBuffer = await data.arrayBuffer();
        const buf = Buffer.from(arrayBuffer);
        if (kind !== 'db') {
          cacheBuffer(cacheKey, buf);
        }
        return buf;
      }
    }

    // Check writable local storage
    try {
      const localDir = getLocalBucketDir(kind);
      const fullPath = path.join(localDir, safeKey);
      if (fs.existsSync(fullPath)) {
        const buf = fs.readFileSync(fullPath);
        if (kind !== 'db') {
          cacheBuffer(cacheKey, buf);
        }
        return buf;
      }
    } catch {
      // ignore
    }

    return null;
  },

  /**
   * Deletes an object from both Supabase Storage and writable local cache.
   */
  async deleteObject(kind: StorageBucketKind, key: string): Promise<boolean> {
    const safeKey = path.basename(key);
    memoryObjectCache.delete(`${kind}:${safeKey}`);

    let deleted = false;
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const bucketName = BUCKET_MAP[kind];
      const objectPath = kind === 'db' ? `__db/${safeKey}` : safeKey;
      const { error } = await supabase.storage
        .from(bucketName)
        .remove([objectPath]);
      if (!error) deleted = true;
    }

    try {
      const localDir = getLocalBucketDir(kind);
      const fullPath = path.join(localDir, safeKey);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        deleted = true;
      }
    } catch {
      // ignore
    }

    return deleted;
  },

  /**
   * Lists objects in a bucket for usage metrics & cleanup.
   */
  async listObjects(
    kind: StorageBucketKind
  ): Promise<Array<{ key: string; sizeBytes: number; mtimeMs: number }>> {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const bucketName = BUCKET_MAP[kind];
      const { data, error } = await supabase.storage.from(bucketName).list('', {
        limit: 200,
      });
      if (!error && data) {
        return data
          .filter((item) => item.name && item.name !== '__db')
          .map((item) => ({
            key: item.name,
            sizeBytes: Number(item.metadata?.size || 0),
            mtimeMs: item.updated_at
              ? new Date(item.updated_at).getTime()
              : Date.now(),
          }));
      }
    }

    try {
      const localDir = getLocalBucketDir(kind);
      if (!fs.existsSync(localDir)) return [];
      const files = fs.readdirSync(localDir);
      const results: Array<{ key: string; sizeBytes: number; mtimeMs: number }> =
        [];
      for (const f of files) {
        try {
          const st = fs.statSync(path.join(localDir, f));
          if (st.isFile()) {
            results.push({
              key: f,
              sizeBytes: st.size,
              mtimeMs: st.mtimeMs,
            });
          }
        } catch {
          // ignore
        }
      }
      return results;
    } catch {
      return [];
    }
  },

  /**
   * Creates an isolated temporary working directory inside os.tmpdir() for FFmpeg video rendering.
   */
  createTempWorkingDir(prefix: string): string {
    const dir = path.join(
      os.tmpdir(),
      'shubhvivah-work',
      `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    );
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  },

  /**
   * Cleans up a temporary working directory inside os.tmpdir() after video processing completes.
   */
  cleanupTempWorkingDir(dirPath: string): void {
    if (!dirPath) return;
    try {
      if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
      }
    } catch {
      // ignore cleanup errors
    }
  },
};
