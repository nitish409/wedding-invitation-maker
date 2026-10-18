/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@napi-rs/canvas', 'ffmpeg-static'],
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
