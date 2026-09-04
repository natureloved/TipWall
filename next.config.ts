import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No `images.remotePatterns` on purpose: external preview images are rendered
  // with plain <img>. A wildcard pattern here would let anyone use the Next
  // image optimizer as a free proxy/resizer for arbitrary URLs.
  async headers() {
    const scriptSources = [
      "'self'",
      "'unsafe-inline'",
      // React and Next.js use eval-based source maps for development stack
      // reconstruction. Keep this development-only so production retains a
      // strict CSP without eval support.
      ...(process.env.NODE_ENV === 'development' ? ["'unsafe-eval'"] : []),
    ].join(' ')
    const contentSecurityPolicy = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      // Next.js and the wallet SDK both need a small amount of inline runtime
      // code. Keep all other executable content same-origin.
      `script-src ${scriptSources}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      // RPC, explorer, price, and wallet integrations are all HTTPS APIs.
      "connect-src 'self' https: wss:",
      "frame-src 'self' https:",
      "media-src 'self' blob:",
    ].join('; ')

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
};

export default nextConfig;
