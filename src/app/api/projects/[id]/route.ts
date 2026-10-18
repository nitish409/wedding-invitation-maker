import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { weddingProjectInputSchema } from '@/lib/validation/projectSchema';
import { enqueueVideoRenderJob } from '@/lib/renderer/videoWorker';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project =
    dbStore.getProjectById(params.id) || dbStore.getProjectBySlug(params.id);

  if (!project) {
    return NextResponse.json(
      { error: 'Wedding invitation project not found' },
      { status: 404 }
    );
  }

  const job = project.latestJobId
    ? dbStore.getRenderJobById(project.latestJobId)
    : null;

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
      dbStore.getProjectById(params.id) || dbStore.getProjectBySlug(params.id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Wedding invitation project not found' },
        { status: 404 }
      );
    }

    const body = await req.json();

    // Allow partial update (e.g. toggling public/private link) or full edit & regenerate
    if (typeof body.isPublic === 'boolean' && Object.keys(body).length === 1) {
      const updated = dbStore.updateProject(existing.id, {
        isPublic: body.isPublic,
      });
      return NextResponse.json({
        success: true,
        project: updated,
        job: existing.latestJobId
          ? dbStore.getRenderJobById(existing.latestJobId)
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

    const updated = dbStore.updateProject(existing.id, parsed.data);
    let job = existing.latestJobId
      ? dbStore.getRenderJobById(existing.latestJobId)
      : null;

    if (body.regenerate) {
      job = dbStore.createRenderJob(existing.id);
      enqueueVideoRenderJob(job.id);
    }

    return NextResponse.json({
      success: true,
      project: dbStore.getProjectById(existing.id) || updated,
      job,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Failed to update project';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
