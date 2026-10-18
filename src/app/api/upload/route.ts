import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { objectStorage } from '@/lib/storage/objectStorage';
import {
  checkRateLimit,
  createSignedToken,
  verifyAudioMagicBytes,
  verifyPhotoMagicBytes,
} from '@/lib/security/tokens';

const ALLOWED_PHOTO_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);
const ALLOWED_AUDIO_MIMES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
]);

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'local-user';
    const rate = checkRateLimit(`upload:${ip}`, 60, 3600 * 1000);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          error: `Upload rate limit exceeded. Try again in ${rate.retryAfterSec}s.`,
        },
        { status: 429 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const type = (formData.get('type') as string) || 'photo'; // 'photo' | 'audio'

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided in upload request.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      return NextResponse.json(
        { error: 'Uploaded file is empty.' },
        { status: 400 }
      );
    }

    if (type === 'photo') {
      const maxPhotoBytes =
        (Number(process.env.MAX_PHOTO_UPLOAD_MB) || 10) * 1024 * 1024;
      if (buffer.length > maxPhotoBytes) {
        return NextResponse.json(
          {
            error: `Photo exceeds maximum allowed size of ${
              process.env.MAX_PHOTO_UPLOAD_MB || 10
            }MB.`,
          },
          { status: 400 }
        );
      }

      if (!ALLOWED_PHOTO_MIMES.has(file.type.toLowerCase())) {
        return NextResponse.json(
          {
            error:
              'Invalid photo format. Only JPG, PNG, and WebP images are allowed.',
          },
          { status: 400 }
        );
      }

      if (!verifyPhotoMagicBytes(buffer, file.type.toLowerCase())) {
        return NextResponse.json(
          {
            error:
              'Uploaded photo failed binary signature validation (corrupted or spoofed file).',
          },
          { status: 400 }
        );
      }

      const ext =
        file.type === 'image/png'
          ? '.png'
          : file.type === 'image/webp'
          ? '.webp'
          : '.jpg';
      const fileName = `photo-${Date.now()}-${crypto
        .randomBytes(6)
        .toString('hex')}${ext}`;

      const uploadResult = await objectStorage.uploadObject(
        'photos',
        fileName,
        buffer,
        file.type
      );

      const token = createSignedToken(fileName, 'photo', 168); // 7 days
      const url = `/api/media/photo/${encodeURIComponent(
        fileName
      )}?token=${encodeURIComponent(token)}`;

      return NextResponse.json({
        success: true,
        fileName: uploadResult.storageKey,
        storageBackend: uploadResult.backend,
        url,
        sizeBytes: buffer.length,
        mimeType: file.type,
      });
    } else if (type === 'audio') {
      const maxAudioBytes =
        (Number(process.env.MAX_AUDIO_UPLOAD_MB) || 25) * 1024 * 1024;
      if (buffer.length > maxAudioBytes) {
        return NextResponse.json(
          {
            error: `Audio file exceeds maximum allowed size of ${
              process.env.MAX_AUDIO_UPLOAD_MB || 25
            }MB.`,
          },
          { status: 400 }
        );
      }

      const lowerMime = file.type.toLowerCase();
      const lowerName = file.name.toLowerCase();
      const isAllowedMime =
        ALLOWED_AUDIO_MIMES.has(lowerMime) ||
        lowerName.endsWith('.mp3') ||
        lowerName.endsWith('.wav');

      if (!isAllowedMime) {
        return NextResponse.json(
          {
            error:
              'Invalid audio format. Only MP3 and WAV audio files are supported.',
          },
          { status: 400 }
        );
      }

      const effectiveMime = lowerName.endsWith('.wav')
        ? 'audio/wav'
        : 'audio/mpeg';
      if (
        !verifyAudioMagicBytes(buffer, effectiveMime) &&
        !verifyAudioMagicBytes(buffer, lowerMime)
      ) {
        return NextResponse.json(
          {
            error:
              'Uploaded audio file failed signature verification. Please upload a valid MP3 or WAV file.',
          },
          { status: 400 }
        );
      }

      const ext =
        lowerName.endsWith('.wav') || lowerMime.includes('wav')
          ? '.wav'
          : '.mp3';
      const fileName = `audio-${Date.now()}-${crypto
        .randomBytes(6)
        .toString('hex')}${ext}`;

      const uploadResult = await objectStorage.uploadObject(
        'audio',
        fileName,
        buffer,
        effectiveMime
      );

      const token = createSignedToken(fileName, 'audio', 168);
      const url = `/api/media/audio/${encodeURIComponent(
        fileName
      )}?token=${encodeURIComponent(token)}`;

      return NextResponse.json({
        success: true,
        fileName: uploadResult.storageKey,
        storageBackend: uploadResult.backend,
        title: file.name.replace(/\.[^.]+$/, ''),
        url,
        sizeBytes: buffer.length,
        mimeType: effectiveMime,
      });
    }

    return NextResponse.json(
      { error: 'Invalid upload type specified.' },
      { status: 400 }
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Storage upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
