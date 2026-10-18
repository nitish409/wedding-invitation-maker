/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@napi-rs/canvas', 'ffmpeg-static'],
    outputFileTracingIncludes: {
      '/api/projects': [
        './node_modules/ffmpeg-static/**/*',
        './public/samples/**/*',
        './public/audio/**/*',
      ],
      '/api/projects/[id]': [
        './node_modules/ffmpeg-static/**/*',
        './public/samples/**/*',
        './public/audio/**/*',
      ],
      '/api/jobs/[id]': [
        './node_modules/ffmpeg-static/**/*',
        './public/samples/**/*',
        './public/audio/**/*',
      ],
      '/api/download/[id]': [
        './node_modules/ffmpeg-static/**/*',
        './public/samples/**/*',
        './public/audio/**/*',
      ],
    },
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
