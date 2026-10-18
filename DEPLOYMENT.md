# Deployment Guide — ShubhVivah Studio

Because ShubhVivah Studio performs real server-side **1080×1920 H.264 + AAC MP4 video encoding** using `@napi-rs/canvas` and `ffmpeg-static`, deploy the application to a platform that supports persistent Node.js processes and long-running background jobs.

---

## 1. Recommended Deployment Platforms

1. **Railway.app / Render.com / Fly.io / DigitalOcean App Platform (Recommended)**:
   - Supports full Node.js runtime, native `@napi-rs/canvas` binaries, `ffmpeg-static`, persistent volumes (or Supabase Storage), and background worker execution without 10-second serverless timeouts.
2. **Docker / VPS (Ubuntu 22.04+ / Debian)**:
   - Install Hindi & Indian script system fonts so Devanagari renders crisply on Linux servers:
     ```bash
     sudo apt-get update && sudo apt-get install -y fonts-noto-core fonts-noto-extra fontconfig
     ```

---

## 2. Configuring Supabase for Production

1. Create a new project at [database.new](https://database.new).
2. Open the **SQL Editor** in your Supabase Dashboard and execute:
   - [`supabase/migrations/001_initial_schema.sql`](./supabase/migrations/001_initial_schema.sql)
   This creates the `templates`, `music_tracks`, `projects`, `render_jobs`, and `system_settings` tables along with private storage buckets (`private-photos`, `custom-audio`, `rendered-videos`).
3. Set the following environment variables in your production host:
   ```env
   NEXT_PUBLIC_APP_URL=https://your-wedding-domain.com
   ADMIN_PASSCODE=your-strong-production-admin-passcode
   DOWNLOAD_SIGNING_SECRET=your-64-char-random-hmac-secret
   STORAGE_MODE=supabase
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

---

## 3. Production Build & Start Commands

```bash
npm install
npm run setup:assets
npm run build
npm run start
```
