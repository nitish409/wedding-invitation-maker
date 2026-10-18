import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';
import {
  enqueueVideoRenderJob,
  executeRenderJob,
} from '@/lib/renderer/videoWorker';
import { isServerlessEnvironment } from '@/lib/storage/objectStorage';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  let job = await dbStore.getRenderJobById(params.id);
  if (!job) {
    return NextResponse.json(
      { error: 'Render job not found' },
      { status: 404 }
    );
  }

  // In serverless environments, if a job is still in 'queued' state when polled,
  // drive the render within this request so it completes reliably.
  if (isServerlessEnvironment() && job.status === 'queued') {
    await executeRenderJob(job.id);
    job = (await dbStore.getRenderJobById(params.id)) || job;
  }

  const project = await dbStore.getProjectById(job.projectId);
  const downloadUrl =
    job.status === 'completed' && job.downloadToken
      ? `/api/download/${job.id}?token=${encodeURIComponent(job.downloadToken)}`
      : undefined;

  return NextResponse.json({
    job: {
      ...job,
      downloadUrl,
    },
    project,
  });
}

// POST /api/jobs/[id] -> Retry a failed or completed job
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const job = await dbStore.getRenderJobById(params.id);
  if (!job) {
    return NextResponse.json(
      { error: 'Render job not found' },
      { status: 404 }
    );
  }

  const updated = await dbStore.updateRenderJob(job.id, {
    status: 'queued',
    progress: 4,
    attempts: (job.attempts || 1) + 1,
    errorMessage: undefined,
    stageMessage: 'Re-queued for fresh HD video rendering...',
  });

  void enqueueVideoRenderJob(job.id);

  return NextResponse.json({
    success: true,
    job: updated,
  });
}
