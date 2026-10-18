import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { STORAGE_DIRS } from '@/lib/db/store';
import { verifySignedToken } from '@/lib/security/tokens';

export async function GET(
  req: NextRequest,
  { params }: { params: { kind: string; filename: string } }
) {
  const { kind, filename } = params;
  const safeName = path.basename(decodeURIComponent(filename));
  const token = req.nextUrl.searchParams.get('token') || '';

  const check = verifySignedToken(token, safeName);
  if (!check.valid) {
    return NextResponse.json(
      { error: check.reason || 'Unauthorized private media access' },
      { status: 403 }
    );
  }

  const baseDir = kind === 'audio' ? STORAGE_DIRS.audio : STORAGE_DIRS.photos;
  const fullPath = path.join(baseDir, safeName);

  if (!fs.existsSync(fullPath)) {
    return NextResponse.json({ error: 'Media file not found' }, { status: 404 });
  }

  const buffer = fs.readFileSync(fullPath);
  const ext = path.extname(safeName).toLowerCase();
  let contentType = 'application/octet-stream';
  if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
  else if (ext === '.png') contentType = 'image/png';
  else if (ext === '.webp') contentType = 'image/webp';
  else if (ext === '.mp3') contentType = 'audio/mpeg';
  else if (ext === '.wav') contentType = 'audio/wav';

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
