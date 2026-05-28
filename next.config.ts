import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['10.247.174.83'],
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  // Allow streaming responses in API routes
  serverExternalPackages: ['@distube/ytdl-core'],
};

export default nextConfig;
