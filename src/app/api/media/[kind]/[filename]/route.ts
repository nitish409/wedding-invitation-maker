import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { objectStorage } from '@/lib/storage/objectStorage';
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

  const bucketKind = kind === 'audio' ? 'audio' : 'photos';
  const buffer = await objectStorage.downloadObject(bucketKind, safeName);

  if (!buffer) {
    return NextResponse.json(
      { error: 'Media file not found in storage' },
      { status: 404 }
    );
  }

  const ext = path.extname(safeName).toLowerCase();
  let contentType = 'application/octet-stream';
  if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
  else if (ext === '.png') contentType = 'image/png';
  else if (ext === '.webp') contentType = 'image/webp';
  else if (ext === '.mp3') contentType = 'audio/mpeg';
  else if (ext === '.wav') contentType = 'audio/wav';

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
