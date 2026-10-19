import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { dbStore } from '@/lib/db/store';
import { weddingProjectInputSchema } from '@/lib/validation/projectSchema';
import {
  enqueueVideoRenderJob,
  executeRenderJob,
} from '@/lib/renderer/videoWorker';
import {
  isServerlessEnvironment,
  objectStorage,
} from '@/lib/storage/objectStorage';
import { WeddingProject } from '@/types/wedding';

export const maxDuration = 60;

async function buildMp4Response(
  req: NextRequest,
  fileBuffer: Buffer,
  project: WeddingProject | null,
  fallbackId: string,
  isDownload: boolean
) {
  const fileSize = fileBuffer.length;
  const safeFileName = project
    ? `${project.brideName.replace(
        /[^a-zA-Z0-9]/g,
        '_'
      )}_Weds_${project.groomName.replace(/[^a-zA-Z0-9]/g, '_')}_Invitation.mp4`
    : `Wedding_Invitation_${fallbackId.slice(0, 8)}.mp4`;

  const disposition = isDownload
    ? `attachment; filename="${safeFileName}"`
    : `inline; filename="${safeFileName}"`;

  const range = req.headers.get('range');
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10) || 0;
    const requestedEnd = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    // Cap individual Range chunks to 3.6MB in serverless so responses stay below Vercel's 4.5MB limit
    const maxChunk = isServerlessEnvironment()
      ? 3.6 * 1024 * 1024
      : fileSize;
    const end = Math.min(fileSize - 1, requestedEnd, start + maxChunk - 1);
    const chunk = fileBuffer.subarray(start, end + 1);

    return new NextResponse(new Uint8Array(chunk), {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(chunk.length),
        'Content-Type': 'video/mp4',
        'Content-Disposition': disposition,
      },
    });
  }

  return new NextResponse(new Uint8Array(fileBuffer), {
    status: 200,
    headers: {
      'Content-Length': String(fileSize),
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes',
      'Content-Disposition': disposition,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let project =
    (await dbStore.getProjectById(params.id)) ||
    (await dbStore.getProjectBySlug(params.id));

  if (!project) {
    return NextResponse.json(
      { error: 'Wedding invitation project not found' },
      { status: 404 }
    );
  }

  let job = project.latestJobId
    ? await dbStore.getRenderJobById(project.latestJobId)
    : null;

  if (isServerlessEnvironment() && job && job.status === 'queued') {
    await executeRenderJob(job.id);
    job = await dbStore.getRenderJobById(job.id);
    project = (await dbStore.getProjectById(project.id)) || project;
  }

  const isStream = req.nextUrl.searchParams.get('stream') === '1';
  const isDownload = req.nextUrl.searchParams.get('download') === '1';

  // Serve MP4 directly from the /api/projects/[id] route so it shares the exact same warm serverless container
  if (isStream || isDownload) {
    if (!job) {
      job = await dbStore.createRenderJob(project.id);
    }
    if (job.status !== 'completed' || !job.outputPath) {
      await executeRenderJob(job.id);
      job = await dbStore.getRenderJobById(job.id);
    }

    let fileBuffer: Buffer | null = null;
    if (job?.outputPath) {
      const storageKey = path.basename(job.outputPath);
      fileBuffer = await objectStorage.downloadObject('renders', storageKey);
      if (!fileBuffer && fs.existsSync(job.outputPath)) {
        fileBuffer = fs.readFileSync(job.outputPath);
      }
    }

    if (!fileBuffer && job) {
      await dbStore.updateRenderJob(job.id, {
        status: 'queued',
        progress: 10,
        attempts: 1,
      });
      await executeRenderJob(job.id);
      job = await dbStore.getRenderJobById(job.id);
      if (job?.outputPath) {
        const storageKey = path.basename(job.outputPath);
        fileBuffer = await objectStorage.downloadObject('renders', storageKey);
      }
    }

    if (!fileBuffer) {
      return NextResponse.json(
        { error: 'Rendered video could not be retrieved from storage.' },
        { status: 404 }
      );
    }

    return buildMp4Response(
      req,
      fileBuffer,
      project,
      job?.id || project.id,
      isDownload
    );
  }

  return NextResponse.json({
    project,
    job,
  });
}

// POST /api/projects/[id] -> Stateless serverless render-and-download fallback
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json().catch(() => ({}));
    let project =
      (await dbStore.getProjectById(params.id)) ||
      (await dbStore.getProjectBySlug(params.id));

    if (!project && body.project) {
      project = await dbStore.upsertProject({
        ...body.project,
        id: body.project.id || params.id,
      });
    }

    if (!project) {
      return NextResponse.json(
        { error: 'Wedding invitation project not found' },
        { status: 404 }
      );
    }

    let job = project.latestJobId
      ? await dbStore.getRenderJobById(project.latestJobId)
      : null;

    if (!job) {
      job = await dbStore.createRenderJob(project.id);
    }

    let fileBuffer: Buffer | null = null;
    if (job.status === 'completed' && job.outputPath) {
      const storageKey = path.basename(job.outputPath);
      fileBuffer = await objectStorage.downloadObject('renders', storageKey);
    }

    if (!fileBuffer) {
      await dbStore.updateRenderJob(job.id, {
        status: 'queued',
        progress: 10,
        attempts: 1,
      });
      await executeRenderJob(job.id);
      job = (await dbStore.getRenderJobById(job.id)) || job;
      if (job.outputPath) {
        const storageKey = path.basename(job.outputPath);
        fileBuffer = await objectStorage.downloadObject('renders', storageKey);
      }
    }

    if (!fileBuffer) {
      return NextResponse.json(
        {
          error:
            job?.errorMessage || 'Failed to generate MP4 video in container.',
        },
        { status: 500 }
      );
    }

    return buildMp4Response(req, fileBuffer, project, job.id, true);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Failed to render and download MP4';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const existing =
      (await dbStore.getProjectById(params.id)) ||
      (await dbStore.getProjectBySlug(params.id));
    if (!existing) {
      return NextResponse.json(
        { error: 'Wedding invitation project not found' },
        { status: 404 }
      );
    }

    const body = await req.json();

    // Allow partial update (e.g. toggling public/private link) or full edit & regenerate
    if (typeof body.isPublic === 'boolean' && Object.keys(body).length === 1) {
      const updated = await dbStore.updateProject(existing.id, {
        isPublic: body.isPublic,
      });
      return NextResponse.json({
        success: true,
        project: updated,
        job: existing.latestJobId
          ? await dbStore.getRenderJobById(existing.latestJobId)
          : null,
      });
    }

    const parsed = weddingProjectInputSchema.safeParse({
      ...existing,
      ...body,
    });
    if (!parsed.success) {
      const firstErr = parsed.error.issues[0];
      return NextResponse.json(
        {
          error: firstErr
            ? `${firstErr.path.join('.')}: ${firstErr.message}`
            : 'Invalid project update data',
        },
        { status: 400 }
      );
    }

    const updated = await dbStore.updateProject(existing.id, parsed.data);
    let job = existing.latestJobId
      ? await dbStore.getRenderJobById(existing.latestJobId)
      : null;

    if (body.regenerate) {
      job = await dbStore.createRenderJob(existing.id);
      if (!isServerlessEnvironment()) {
        void enqueueVideoRenderJob(job.id);
      }
    }

    return NextResponse.json({
      success: true,
      project: (await dbStore.getProjectById(existing.id)) || updated,
      job,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Failed to update project';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
