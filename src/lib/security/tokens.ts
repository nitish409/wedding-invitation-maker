import crypto from 'crypto';

const SECRET =
  process.env.DOWNLOAD_SIGNING_SECRET || 'shubhvivah-hmac-signing-secret-key-2026-prod';

export interface SignedTokenPayload {
  resourceId: string;
  kind: 'video' | 'photo' | 'audio';
  exp: number; // Unix timestamp ms
}

export function createSignedToken(
  resourceId: string,
  kind: 'video' | 'photo' | 'audio',
  expiryHours: number = 72
): string {
  const payload: SignedTokenPayload = {
    resourceId,
    kind,
    exp: Date.now() + expiryHours * 3600 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifySignedToken(
  token: string,
  expectedResourceId?: string
): { valid: boolean; reason?: string; payload?: SignedTokenPayload } {
  try {
    if (!token || !token.includes('.')) {
      return { valid: false, reason: 'Malformed security token' };
    }
    const [encoded, signature] = token.split('.');
    const expectedSig = crypto
      .createHmac('sha256', SECRET)
      .update(encoded)
      .digest('base64url');
    if (signature !== expectedSig) {
      return { valid: false, reason: 'Invalid token signature' };
    }
    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf-8')
    ) as SignedTokenPayload;
    if (Date.now() > payload.exp) {
      return { valid: false, reason: 'Download link has expired' };
    }
    if (expectedResourceId && payload.resourceId !== expectedResourceId) {
      return { valid: false, reason: 'Token resource mismatch' };
    }
    return { valid: true, payload };
  } catch {
    return { valid: false, reason: 'Failed to parse security token' };
  }
}

// Rate Limiting Store (IP -> timestamps[])
const rateLimitMap = new Map<string, number[]>();

export function checkRateLimit(
  identifier: string,
  maxRequests: number = 25,
  windowMs: number = 3600 * 1000
): { allowed: boolean; remaining: number; retryAfterSec?: number } {
  const now = Date.now();
  const prev = rateLimitMap.get(identifier) || [];
  const valid = prev.filter((ts) => now - ts < windowMs);
  if (valid.length >= maxRequests) {
    const oldest = valid[0];
    const retryAfterSec = Math.ceil((windowMs - (now - oldest)) / 1000);
    return { allowed: false, remaining: 0, retryAfterSec };
  }
  valid.push(now);
  rateLimitMap.set(identifier, valid);
  return { allowed: true, remaining: maxRequests - valid.length };
}

export function verifyPhotoMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 12) return false;
  // JPEG: FF D8 FF
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  // PNG: 89 50 4E 47
  if (mimeType === 'image/png') {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }
  // WebP: RIFF....WEBP
  if (mimeType === 'image/webp') {
    return (
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  return false;
}

export function verifyAudioMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 12) return false;
  // WAV: RIFF....WAVE
  if (
    mimeType === 'audio/wav' ||
    mimeType === 'audio/x-wav' ||
    mimeType === 'audio/wave'
  ) {
    return (
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WAVE'
    );
  }
  // MP3: ID3 tag or MPEG sync word (FF FB / FF F3 / FF F2 / FF E3)
  if (mimeType === 'audio/mpeg' || mimeType === 'audio/mp3') {
    const isId3 = buffer.subarray(0, 3).toString('ascii') === 'ID3';
    const isSync = buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0;
    return isId3 || isSync;
  }
  return false;
}
