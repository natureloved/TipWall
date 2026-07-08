import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@nimiq/core'],
  // No `images.remotePatterns` on purpose: external preview images are rendered
  // with plain <img>. A wildcard pattern here would let anyone use the Next
  // image optimizer as a free proxy/resizer for arbitrary URLs.
};

export default nextConfig;
