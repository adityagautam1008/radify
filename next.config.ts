import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  // Allow streaming responses in API routes
  serverExternalPackages: ['@distube/ytdl-core'],
};

export default nextConfig;
