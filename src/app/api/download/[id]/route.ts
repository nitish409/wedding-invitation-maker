import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { dbStore } from '@/lib/db/store';
import { objectStorage } from '@/lib/storage/objectStorage';
import { verifySignedToken } from '@/lib/security/tokens';
import { executeRenderJob } from '@/lib/renderer/videoWorker';

export const maxDuration = 60;

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let job = await dbStore.getRenderJobById(params.id);
  if (!job || job.status !== 'completed' || !job.outputPath) {
    return NextResponse.json(
      { error: 'Rendered video is not ready or does not exist.' },
      { status: 404 }
    );
  }

  // Verify expiring download token
  const token = req.nextUrl.searchParams.get('token') || '';
  const verification = verifySignedToken(token, job.id);
  if (!verification.valid) {
    return NextResponse.json(
      {
        error: verification.reason || 'Download link expired or invalid token.',
      },
      { status: 403 }
    );
  }

  if (job.expiresAt && new Date(job.expiresAt).getTime() < Date.now()) {
    return NextResponse.json(
      {
        error:
          'This download link has expired. Please click Regenerate to create a fresh link.',
      },
      { status: 410 }
    );
  }

  // Retrieve MP4 buffer from objectStorage (Supabase Storage / persistent store)
  let storageKey = path.basename(job.outputPath);
  let fileBuffer = await objectStorage.downloadObject('renders', storageKey);

  // Legacy path fallback if outputPath was an absolute path
  if (!fileBuffer && fs.existsSync(job.outputPath)) {
    fileBuffer = fs.readFileSync(job.outputPath);
  }

  // If running in stateless serverless mode without Supabase and this request hit a cold container
  // where os.tmpdir() doesn't have the MP4 yet, regenerate on-the-fly so the download always succeeds
  if (!fileBuffer) {
    await dbStore.updateRenderJob(job.id, {
      status: 'queued',
      progress: 10,
      attempts: 1,
    });
    await executeRenderJob(job.id);
    job = (await dbStore.getRenderJobById(params.id)) || job;
    if (job.outputPath) {
      storageKey = path.basename(job.outputPath);
      fileBuffer = await objectStorage.downloadObject('renders', storageKey);
    }
  }

  if (!fileBuffer) {
    return NextResponse.json(
      { error: 'Video file was cleaned up or removed from storage.' },
      { status: 404 }
    );
  }

  const fileSize = fileBuffer.length;
  const project = await dbStore.getProjectById(job.projectId);
  const safeFileName = project
    ? `${project.brideName.replace(
        /[^a-zA-Z0-9]/g,
        '_'
      )}_Weds_${project.groomName.replace(/[^a-zA-Z0-9]/g, '_')}_Invitation.mp4`
    : `Wedding_Invitation_${job.id.slice(0, 8)}.mp4`;

  const isDownload = req.nextUrl.searchParams.get('download') === '1';
  const disposition = isDownload
    ? `attachment; filename="${safeFileName}"`
    : `inline; filename="${safeFileName}"`;

  const range = req.headers.get('range');
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
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
