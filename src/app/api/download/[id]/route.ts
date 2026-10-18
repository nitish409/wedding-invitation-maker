import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { dbStore } from '@/lib/db/store';
import { verifySignedToken } from '@/lib/security/tokens';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const job = dbStore.getRenderJobById(params.id);
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
      { error: verification.reason || 'Download link expired or invalid token.' },
      { status: 403 }
    );
  }

  if (job.expiresAt && new Date(job.expiresAt).getTime() < Date.now()) {
    return NextResponse.json(
      { error: 'This download link has expired. Please click Regenerate to create a fresh link.' },
      { status: 410 }
    );
  }

  if (!fs.existsSync(job.outputPath)) {
    return NextResponse.json(
      { error: 'Video file was cleaned up or removed from storage.' },
      { status: 404 }
    );
  }

  const stat = fs.statSync(job.outputPath);
  const fileSize = stat.size;
  const project = dbStore.getProjectById(job.projectId);
  const safeFileName = project
    ? `${project.brideName.replace(/[^a-zA-Z0-9]/g, '_')}_Weds_${project.groomName.replace(
        /[^a-zA-Z0-9]/g,
        '_'
      )}_Invitation.mp4`
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
    const chunkSize = end - start + 1;
    const buffer = Buffer.alloc(chunkSize);
    const fd = fs.openSync(job.outputPath, 'r');
    fs.readSync(fd, buffer, 0, chunkSize, start);
    fs.closeSync(fd);

    return new NextResponse(buffer, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(chunkSize),
        'Content-Type': 'video/mp4',
        'Content-Disposition': disposition,
      },
    });
  }

  const fileBuffer = fs.readFileSync(job.outputPath);
  return new NextResponse(fileBuffer, {
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
