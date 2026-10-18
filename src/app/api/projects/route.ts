import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { weddingProjectInputSchema } from '@/lib/validation/projectSchema';
import { enqueueVideoRenderJob } from '@/lib/renderer/videoWorker';
import { checkRateLimit } from '@/lib/security/tokens';
import { isServerlessEnvironment } from '@/lib/storage/objectStorage';

export async function GET() {
  const [templates, musicTracks, settings] = await Promise.all([
    dbStore.listTemplates(false),
    dbStore.listMusicTracks(false),
    dbStore.getSettings(),
  ]);
  return NextResponse.json({
    templates,
    musicTracks,
    settings,
  });
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'local-user';
    const settings = await dbStore.getSettings();
    const rate = checkRateLimit(
      `render:${ip}`,
      settings.maxRendersPerIpHour || 20,
      3600 * 1000
    );
    if (!rate.allowed) {
      return NextResponse.json(
        {
          error: `Rate limit reached (${settings.maxRendersPerIpHour} renders/hour). Please try again in ${rate.retryAfterSec}s.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = weddingProjectInputSchema.safeParse(body);
    if (!parsed.success) {
      const firstErr = parsed.error.issues[0];
      return NextResponse.json(
        {
          error: firstErr
            ? `${firstErr.path.join('.')}: ${firstErr.message}`
            : 'Invalid wedding project data',
          issues: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const project = await dbStore.createProject(parsed.data);
    const startRender = body.startRender !== false;

    let job = null;
    if (startRender) {
      job = await dbStore.createRenderJob(project.id);
      if (isServerlessEnvironment()) {
        // In serverless environments (Vercel/Lambda), background work after response is frozen;
        // await or drive on job status poll.
        void enqueueVideoRenderJob(job.id);
      } else {
        void enqueueVideoRenderJob(job.id);
      }
    }

    return NextResponse.json({
      success: true,
      project: await dbStore.getProjectById(project.id),
      job,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Failed to create wedding project';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
