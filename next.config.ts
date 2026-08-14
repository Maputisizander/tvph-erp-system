import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ponytail: cacheComponents enabled stale router.refresh() after mutations (all approval banners needed F5);
  // disable until fixed — instant prefetch benefit was negligible vs stale UX
  cacheComponents: false,
  experimental: {
    serverActions: { bodySizeLimit: '25mb' },
    // proxy.ts buffers request bodies while cloning for the proxy; default 10MB
    // truncates multi-file Server Action uploads (2 required docs, up to 10MB each)
    proxyClientMaxBodySize: '25mb',
  },
  serverExternalPackages: ["pdfkit", "pdfjs-dist", "@napi-rs/canvas"],
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
