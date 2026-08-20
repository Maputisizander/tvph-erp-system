import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ponytail: cacheComponents enabled stale router.refresh() after mutations (all approval banners needed F5);
  // disable until fixed — instant prefetch benefit was negligible vs stale UX
  cacheComponents: false,
  experimental: {
    // 60mb keeps the proxy's silent body truncation and the Server Action body
    // limit above the 50MB-per-file cap enforced in the upload actions, so an
    // oversized file reaches the action and returns a clear error instead of
    // being silently truncated (the old 25mb limit corrupted >25MB uploads).
    serverActions: { bodySizeLimit: '60mb' },
    proxyClientMaxBodySize: '60mb',
  },
  serverExternalPackages: ["pdfkit"],
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
        ],
      },
    ];
  },
  async redirects() {
    // Serve the static user guide (public/docs/index.html) at /docs. The
    // redirect to the index keeps the guide's relative img/ paths resolving.
    return [
      { source: "/docs", destination: "/docs/index.html", permanent: false },
    ];
  },
};

export default nextConfig;
