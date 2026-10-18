import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { enqueueVideoRenderJob } from '@/lib/renderer/videoWorker';
import { MusicTrackItem, TemplateDefinition } from '@/types/wedding';

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.ADMIN_PASSCODE || 'shubhvivah-admin-2026';
  const headerPass = req.headers.get('x-admin-passcode');
  const cookiePass = req.cookies.get('admin_passcode')?.value;
  return headerPass === expected || cookiePass === expected;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid admin credentials' },
      { status: 401 }
    );
  }

  return NextResponse.json({
    stats: dbStore.getUsageStats(),
    projects: dbStore.listProjects(),
    jobs: dbStore.listRenderJobs(),
    templates: dbStore.listTemplates(true),
    musicTracks: dbStore.listMusicTracks(true),
    settings: dbStore.getSettings(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Action: login verification
    if (body.action === 'login') {
      const expected = process.env.ADMIN_PASSCODE || 'shubhvivah-admin-2026';
      if (body.passcode !== expected) {
        return NextResponse.json(
          { error: 'Invalid admin passcode.' },
          { status: 401 }
        );
      }
      const res = NextResponse.json({ success: true });
      res.cookies.set('admin_passcode', expected, {
        httpOnly: true,
        path: '/',
        maxAge: 86400 * 7,
      });
      return res;
    }

    if (body.action === 'logout') {
      const res = NextResponse.json({ success: true });
      res.cookies.delete('admin_passcode');
      return res;
    }

    if (!isAuthorized(req)) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin authentication required' },
        { status: 401 }
      );
    }

    switch (body.action) {
      case 'toggleTemplate': {
        const updated = dbStore.toggleTemplate(body.templateId, Boolean(body.enabled));
        return NextResponse.json({
          success: true,
          template: updated,
          templates: dbStore.listTemplates(true),
        });
      }

      case 'addTemplate': {
        const tpl: TemplateDefinition = {
          id:
            body.id ||
            `custom-${Date.now().toString(36)}`,
          name: body.name || 'Custom Royal Template',
          nameHindi: body.nameHindi || 'विशेष विवाह टेम्पलेट',
          subtitle: body.subtitle || 'Custom Palette & Royal Borders',
          description:
            body.description ||
            'Custom animated Indian wedding invitation template created by Admin.',
          enabled: true,
          primaryColor: body.primaryColor || '#5C0A1B',
          secondaryColor: body.secondaryColor || '#D4AF37',
          accentColor: body.accentColor || '#F3E5AB',
          bgColor: body.bgColor || '#3B0510',
          bgGradientEnd: body.bgGradientEnd || '#1A0207',
          textColor: body.textColor || '#FFFDF9',
          mutedTextColor: body.mutedTextColor || '#F3E5AB',
          defaultMusicId: body.defaultMusicId || 'royal-shehnai',
          previewBadge: body.previewBadge || 'Custom',
          features: body.features || [
            'Custom color theme',
            'Animated mandala & borders',
          ],
          motifStyle: body.motifStyle || 'mandala',
        };
        const templates = dbStore.upsertTemplate(tpl);
        return NextResponse.json({ success: true, templates });
      }

      case 'addMusicTrack': {
        const track: MusicTrackItem = {
          id: body.id || `track-${Date.now().toString(36)}`,
          title: body.title || 'Approved Wedding Instrumental',
          artist: body.artist || 'ShubhVivah Studio (Royalty-Free)',
          category: body.category || 'Traditional',
          durationSec: Number(body.durationSec) || 60,
          url: body.url,
          isDefault: Boolean(body.isDefault),
          enabled: true,
          description:
            body.description || 'Admin-approved royalty-free wedding music track.',
        };
        const musicTracks = dbStore.addMusicTrack(track);
        return NextResponse.json({ success: true, musicTracks });
      }

      case 'toggleMusicTrack': {
        dbStore.toggleMusicTrack(body.trackId, Boolean(body.enabled));
        return NextResponse.json({
          success: true,
          musicTracks: dbStore.listMusicTracks(true),
        });
      }

      case 'updateSettings': {
        const settings = dbStore.updateSettings({
          resolutionWidth: Number(body.resolutionWidth) || 1080,
          resolutionHeight: Number(body.resolutionHeight) || 1920,
          fps: Number(body.fps) || 30,
          linkExpiryHours: Number(body.linkExpiryHours) || 72,
          autoDeleteTempHours: Number(body.autoDeleteTempHours) || 24,
          maxRendersPerIpHour: Number(body.maxRendersPerIpHour) || 20,
        });
        return NextResponse.json({ success: true, settings });
      }

      case 'retryJob': {
        const job = dbStore.getRenderJobById(body.jobId);
        if (!job) {
          return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }
        dbStore.updateRenderJob(job.id, {
          status: 'queued',
          progress: 5,
          attempts: (job.attempts || 1) + 1,
          errorMessage: undefined,
          stageMessage: 'Re-queued by Admin for fresh video render...',
        });
        enqueueVideoRenderJob(job.id);
        return NextResponse.json({
          success: true,
          jobs: dbStore.listRenderJobs(),
        });
      }

      case 'cleanupStorage': {
        const result = dbStore.cleanupExpiredFiles();
        return NextResponse.json({
          success: true,
          deletedFiles: result.deletedFiles,
          stats: dbStore.getUsageStats(),
        });
      }

      default:
        return NextResponse.json(
          { error: 'Unknown admin action' },
          { status: 400 }
        );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Admin request failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
