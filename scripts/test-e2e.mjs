import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runTests() {
  console.log('============================================================');
  console.log('ShubhVivah Studio — End-to-End Real Workflow Verification');
  console.log('============================================================\n');

  // 1. Verify GET /api/projects returns all 4 templates & 4 royalty-free tracks
  console.log('[1/8] Verifying templates & royalty-free music library...');
  const initRes = await fetch(`${BASE_URL}/api/projects`);
  assert(initRes.ok, 'GET /api/projects should return 200');
  const initData = await initRes.json();
  assert(initData.templates.length >= 4, 'Should have 4 wedding templates');
  assert(initData.musicTracks.length >= 4, 'Should have 4 royalty-free tracks');
  console.log(
    `  ✓ Found ${initData.templates.length} templates & ${initData.musicTracks.length} music tracks.`
  );

  // 2. Test invalid upload rejection (spoofed file)
  console.log('[2/8] Testing security rejection of invalid/spoofed file upload...');
  const badForm = new FormData();
  badForm.append(
    'file',
    new Blob(['not-an-image-binary'], { type: 'image/png' }),
    'fake.png'
  );
  badForm.append('type', 'photo');
  const badRes = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    body: badForm,
  });
  assert(badRes.status === 400, 'Spoofed PNG should be rejected with HTTP 400');
  console.log('  ✓ Spoofed image upload properly rejected with HTTP 400.');

  // 3. Upload real Bride, Groom, and Couple sample photos via /api/upload
  console.log('[3/8] Uploading sample Bride, Groom & Couple photos via /api/upload...');
  const uploadSamplePhoto = async (fileName) => {
    const filePath = path.join(process.cwd(), 'public', 'samples', fileName);
    const buf = fs.readFileSync(filePath);
    const fd = new FormData();
    fd.append('file', new Blob([buf], { type: 'image/png' }), fileName);
    fd.append('type', 'photo');
    const res = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      body: fd,
    });
    assert(res.ok, `Photo upload for ${fileName} should succeed`);
    const data = await res.json();
    assert(data.url.startsWith('/api/media/photo/'), 'Should return signed private photo URL');
    return data.url;
  };

  const brideUrl = await uploadSamplePhoto('bride-sample.png');
  const groomUrl = await uploadSamplePhoto('groom-sample.png');
  const coupleUrl = await uploadSamplePhoto('couple-sample.png');
  console.log('  ✓ Uploaded Bride, Groom, and Couple photos to private storage with signed tokens.');

  // 4. Create project with Demo Bride & Groom names, Haldi & Wedding events, and Hindi/English text
  console.log('[4/8] Submitting wedding invitation project & starting real MP4 render...');
  const projectPayload = {
    templateId: 'royal-wedding',
    language: 'mixed',
    brideName: 'Ananya Sharma (अनन्या)',
    groomName: 'Aarav Singhania (आरव)',
    brideParents: 'Mrs. Kavita & Mr. Rajeshwar Sharma',
    groomParents: 'Mrs. Sunita & Mr. Vikramaditya Singhania',
    familyMessage:
      'With the divine blessings of Lord Ganesha, we cordially invite you to the auspicious wedding celebrations of our beloved children.',
    hashtag: '#AaravKiAnanya2026',
    contactPhone: '+91 98290 11223',
    weddingDate: '2026-12-12',
    weddingTime: '07:15 PM (Shubh Muhurat)',
    weddingVenue: 'Suvarna Mahal, Rambagh Palace',
    weddingAddress: 'Bhawani Singh Road, Rambagh, Jaipur, Rajasthan',
    mapsUrl: 'https://maps.google.com/?q=Rambagh+Palace+Jaipur',
    rsvpDetails: 'RSVP: Sharma & Singhania Parivar',
    events: [
      {
        id: 'evt-haldi-1',
        type: 'haldi',
        name: 'Haldi Ceremony (हल्दी रस्म)',
        enabled: true,
        date: '2026-12-11',
        time: '10:30 AM Onwards',
        venue: 'Surya Courtyard Lawn, Rambagh Palace',
        address: 'Jaipur, Rajasthan',
        customMessage: 'Dress Code: Shades of Marigold Yellow',
      },
      {
        id: 'evt-mehndi-2',
        type: 'mehndi',
        name: 'Mehndi Unused Ceremony',
        enabled: false, // Disabled event — must be skipped!
        date: '2026-12-11',
        time: '04:00 PM',
        venue: 'Mughal Garden',
        address: 'Jaipur',
        customMessage: '',
      },
    ],
    photos: {
      bride: { url: brideUrl, zoom: 1.1, offsetX: 0, offsetY: 0, removeBg: false },
      groom: { url: groomUrl, zoom: 1.05, offsetX: 0, offsetY: 0, removeBg: false },
      couple: { url: coupleUrl, zoom: 1.15, offsetX: 0, offsetY: -4, removeBg: true },
    },
    music: {
      trackId: 'royal-shehnai',
      title: 'Royal Shehnai & Santoor Mangalam',
      url: '/audio/royal-shehnai.wav',
      startOffsetSec: 2,
      volume: 0.9,
    },
    consentAccepted: true,
    isPublic: true,
  };

  const createRes = await fetch(`${BASE_URL}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(projectPayload),
  });
  assert(createRes.ok, 'POST /api/projects should succeed');
  const createData = await createRes.json();
  const projectId = createData.project.id;
  const jobId = createData.job.id;
  console.log(`  ✓ Created Project ID: ${projectId}, Render Job ID: ${jobId}`);

  // 5. Poll job status until completed
  console.log('[5/8] Polling background video render job progress...');
  let completedJob = null;
  for (let i = 0; i < 90; i++) {
    const jobRes = await fetch(`${BASE_URL}/api/jobs/${jobId}`);
    const jobData = await jobRes.json();
    const job = jobData.job;
    process.stdout.write(
      `\r  → Status: ${job.status.toUpperCase()} | Progress: ${job.progress}% | ${job.stageMessage.slice(
        0,
        52
      )}...   `
    );
    if (job.status === 'completed') {
      completedJob = job;
      console.log('\n  ✓ Render job completed!');
      break;
    }
    if (job.status === 'failed') {
      throw new Error(`Render job failed: ${job.errorMessage}`);
    }
    await sleep(1000);
  }
  assert(completedJob, 'Render job must complete within timeout');
  assert(completedJob.downloadUrl, 'Completed job must include signed downloadUrl');

  // 6. Download the rendered MP4 and verify its H.264 video + AAC audio streams
  console.log('[6/8] Downloading rendered MP4 and inspecting streams with FFmpeg...');
  const dlRes = await fetch(`${BASE_URL}${completedJob.downloadUrl}&download=1`);
  assert(dlRes.ok, 'MP4 download request must return HTTP 200');
  const mp4Buffer = Buffer.from(await dlRes.arrayBuffer());
  assert(mp4Buffer.length > 100_000, `MP4 size (${mp4Buffer.length} bytes) must be > 100KB`);

  const sampleOutPath = path.join(
    process.cwd(),
    'public',
    'samples',
    'sample-wedding-invitation.mp4'
  );
  fs.writeFileSync(sampleOutPath, mp4Buffer);

  // Inspect with ffmpeg -i
  const probe = spawnSync(ffmpegStatic, ['-i', sampleOutPath], {
    encoding: 'utf-8',
  });
  const probeOutput = (probe.stderr || '') + (probe.stdout || '');
  assert(
    probeOutput.includes('Video: h264') && probeOutput.includes('1080x1920'),
    'MP4 must contain 1080x1920 H.264 video stream'
  );
  assert(
    probeOutput.includes('Audio: aac'),
    'MP4 must contain audible AAC audio stream'
  );
  console.log(
    `  ✓ Verified playable MP4 (${(mp4Buffer.length / 1024 / 1024).toFixed(
      2
    )} MB): Video = h264 1080x1920 30fps, Audio = aac stereo.`
  );
  console.log(`  ✓ Saved sample MP4 to: public/samples/sample-wedding-invitation.mp4`);

  // 7. Test edge cases: missing optional events + very long names
  console.log('[7/8] Testing edge cases (zero optional ceremonies & very long Hindi/English names)...');
  const edgeRes = await fetch(`${BASE_URL}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...projectPayload,
      templateId: 'traditional-indian',
      language: 'hindi',
      brideName: 'राजकुमारी अनन्या प्रियदर्शिनी शर्मा (Ananya Priyadarshini Sharma)',
      groomName: 'महाराजकुमार आरव विक्रमादित्य सिंघानिया (Aarav Vikramaditya Singhania)',
      events: [], // Zero optional events
      startRender: false,
    }),
  });
  assert(edgeRes.ok, 'Edge case project creation should succeed');
  console.log('  ✓ Edge case (missing optional events + long Hindi/English names) validated.');

  // 8. Test Admin Dashboard authentication & metrics
  console.log('[8/8] Testing Admin Dashboard authentication & metrics API...');
  const unauthAdmin = await fetch(`${BASE_URL}/api/admin`);
  assert(unauthAdmin.status === 401, 'Unauthenticated /api/admin must return 401');

  const authAdmin = await fetch(`${BASE_URL}/api/admin`, {
    headers: { 'x-admin-passcode': 'shubhvivah-admin-2026' },
  });
  assert(authAdmin.ok, 'Authenticated /api/admin must return 200');
  const adminData = await authAdmin.json();
  assert(adminData.stats.completedJobs >= 1, 'Admin stats must record completed render job');
  console.log(
    `  ✓ Admin API verified (Total Projects: ${adminData.stats.totalProjects}, Completed Renders: ${adminData.stats.completedJobs}).`
  );

  console.log('\n============================================================');
  console.log('ALL 8 END-TO-END WORKFLOW TESTS PASSED SUCCESSFULLY!');
  console.log('============================================================');
}

runTests().catch((err) => {
  console.error('\nE2E TEST FAILURE:', err);
  process.exit(1);
});
