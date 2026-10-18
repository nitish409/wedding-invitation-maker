import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { weddingProjectInputSchema } from '@/lib/validation/projectSchema';
import {
  enqueueVideoRenderJob,
  executeRenderJob,
} from '@/lib/renderer/videoWorker';
import { isServerlessEnvironment } from '@/lib/storage/objectStorage';

export const maxDuration = 60;

export async function GET(
  _req: NextRequest,
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

  return NextResponse.json({
    project,
    job,
  });
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
