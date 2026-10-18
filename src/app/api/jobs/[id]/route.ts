import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { enqueueVideoRenderJob } from '@/lib/renderer/videoWorker';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const job = dbStore.getRenderJobById(params.id);
  if (!job) {
    return NextResponse.json({ error: 'Render job not found' }, { status: 404 });
  }

  const project = dbStore.getProjectById(job.projectId);
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
  const job = dbStore.getRenderJobById(params.id);
  if (!job) {
    return NextResponse.json({ error: 'Render job not found' }, { status: 404 });
  }

  const updated = dbStore.updateRenderJob(job.id, {
    status: 'queued',
    progress: 4,
    attempts: (job.attempts || 1) + 1,
    errorMessage: undefined,
    stageMessage: 'Re-queued for fresh HD video rendering...',
  });

  enqueueVideoRenderJob(job.id);

  return NextResponse.json({
    success: true,
    job: updated,
  });
}
