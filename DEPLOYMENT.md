# Deployment & Supabase Storage Guide — ShubhVivah Studio

ShubhVivah Studio is architected to never write persistent files to `/var/task`, `process.cwd()/data`, or any read-only serverless bundle directory.

- **Uploaded Photos, Custom Audio & Rendered MP4s** are stored via [`src/lib/storage/objectStorage.ts`](./src/lib/storage/objectStorage.ts) in **Supabase Storage** (`private-photos`, `custom-audio`, `rendered-videos` buckets) when Supabase credentials are configured, or in an OS-appropriate persistent storage directory outside `/var/task` for local development.
- **Wedding Invitation Projects & Render Jobs** are stored via [`src/lib/db/store.ts`](./src/lib/db/store.ts) in **Supabase PostgreSQL** (`projects`, `render_jobs`) and persistent object storage.
- **Temporary FFmpeg Video Processing Files** are created exclusively inside `os.tmpdir()` (`path.join(os.tmpdir(), 'shubhvivah-work', ...)`) with `{ recursive: true }` and are automatically deleted in a `finally` block immediately after the rendered MP4 is uploaded.

---

## 1. Required Environment Variables for Vercel / Serverless Deployment

Configure the following environment variables in your Vercel Project Settings (**Settings → Environment Variables**):

| Environment Variable | Required | Description |
| :--- | :---: | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** (Production) | Your Supabase Project URL (e.g. `https://xyzcompany.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** (Production) | Your Supabase `anon` public API key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** (Recommended) | Your Supabase `service_role` secret key (allows the server to auto-create private storage buckets and bypass RLS for server-side uploads/renders) |
| `DOWNLOAD_SIGNING_SECRET` | **Yes** | Any strong random string used to sign expiring MP4 & private media URLs |
| `ADMIN_PASSCODE` | **Yes** | Passcode for accessing `/admin` (default: `shubhvivah-admin-2026`) |
| `NEXT_PUBLIC_APP_URL` | Optional | Your deployed domain (e.g. `https://wedding-invitation-maker-omega.vercel.app`) |
| `SUPABASE_PHOTOS_BUCKET` | Optional | Defaults to `private-photos` |
| `SUPABASE_AUDIO_BUCKET` | Optional | Defaults to `custom-audio` |
| `SUPABASE_RENDERS_BUCKET` | Optional | Defaults to `rendered-videos` |

---

## 2. Setting Up Your Supabase Project (2 Minutes)

1. Create a free project at [database.new](https://database.new).
2. In your Supabase Dashboard, open the **SQL Editor** and run the migration script:
   - [`supabase/migrations/001_initial_schema.sql`](./supabase/migrations/001_initial_schema.sql)
   - This creates the `projects` and `render_jobs` tables as well as the three storage buckets (`private-photos`, `custom-audio`, `rendered-videos`).
   - *Note*: Even if you don't manually create the storage buckets, providing `SUPABASE_SERVICE_ROLE_KEY` allows `objectStorage.ts` to automatically create the buckets on first upload.
3. Copy your `Project URL`, `anon` key, and `service_role` key from **Project Settings → API** into your Vercel Environment Variables and redeploy.

---

## 3. Production Build & Start Commands

```bash
npm install
npm run build
npm run start
```
*(Note: `npm run build` automatically runs `node scripts/generate-assets.mjs` before `next build` so all built-in royalty-free wedding `.wav` audio tracks and sample portraits are bundled automatically).*
