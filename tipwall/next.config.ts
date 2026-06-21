import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@nimiq/core'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
