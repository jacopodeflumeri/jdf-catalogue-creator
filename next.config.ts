import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for Docker/ECS deployment
  output: "standalone",

  // Disable source maps in production to reduce memory usage
  productionBrowserSourceMaps: process.env["ENABLE_SOURCE_MAPS"] === "true",

  // Increase body size limit for large dataset uploads
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb", // Server Actions (form submissions)
    },
    proxyClientMaxBodySize: "100mb", // Proxy body buffer limit (renamed from middlewareClientMaxBodySize in Next.js 16)
  },

  // Note: API route body size limit (4.5MB default in Next.js 16)
  // This is handled via route segment config in individual routes
  // See: src/app/api/upload/route.ts and src/app/api/admin/upload/route.ts

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: `${process.env["S3_BUCKET_NAME"]}.s3.${process.env["S3_REGION"]}.amazonaws.com`,
      },
    ],
  },

  // Security Headers Configuration
  async headers() {
    // Check if we're running on localhost (for development and local testing)
    const isLocalhost =
      process.env["NEXTAUTH_URL"]?.includes("localhost") ||
      process.env["NEXTAUTH_URL"]?.includes("127.0.0.1") ||
      !process.env["NEXTAUTH_URL"]?.startsWith("https://");

    // S3 hosts for client code that fetch()es a presigned GET/PUT URL directly
    // (s3_storage). The template's own uploads go through /api/upload, so this
    // is headroom for apps that upload straight to the bucket.
    const s3Region = process.env["S3_REGION"];
    const s3ConnectSrc = [
      "https://*.s3.amazonaws.com",
      ...(s3Region ? [`https://*.s3.${s3Region}.amazonaws.com`] : []),
    ];

    return [
      {
        // Apply security headers to all routes
        source: "/(.*)",
        headers: [
          // Content Security Policy (CSP)
          //
          // Lists only hosts the template's own browser code loads from. When a
          // feature needs another host, add it here with a comment naming the
          // code that needs it. Not listed on purpose:
          //   - Keycloak / legacy Entra (login.microsoftonline.com): OIDC is
          //     full-page navigation, which CSP does not govern.
          //   - graph.microsoft.com, Notion, LiteLLM, internal Mapp APIs:
          //     called server-side only.
          //   - Google Fonts: next/font self-hosts them at build time.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // cdn.jsdelivr.net: Swagger UI for the public_api docs page
              // (src/modules/public_api/openapi/generator.ts).
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
              "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
              "font-src 'self' data:",
              // https: covers presigned S3 and CloudFront image URLs.
              "img-src 'self' data: blob: https: http:",
              ["connect-src 'self'", ...s3ConnectSrc].join(" "),
              "frame-src 'self'",
              "worker-src 'self' blob:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              // Only add upgrade-insecure-requests when NOT on localhost
              ...(!isLocalhost ? ["upgrade-insecure-requests"] : []),
            ].join("; "),
          },

          // Prevent clickjacking
          {
            key: "X-Frame-Options",
            value: "DENY",
          },

          // Prevent MIME type sniffing
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },

          // XSS Protection (legacy but still useful)
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },

          // Referrer Policy
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },

          // Permissions Policy (formerly Feature Policy)
          {
            key: "Permissions-Policy",
            value: [
              "camera=()",
              "microphone=()",
              "geolocation=()",
              "payment=()",
              "usb=()",
              "magnetometer=()",
              "gyroscope=()",
              "accelerometer=()",
            ].join(", "),
          },

          // HSTS (HTTP Strict Transport Security) - only when NOT on localhost
          ...(!isLocalhost
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000; includeSubDomains; preload",
                },
              ]
            : []),

          // Cross-Origin Policies
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Resource-Policy",
            value: "cross-origin", // Lets other origins embed this app's assets (e.g. images in emails)
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "unsafe-none", // Changed from 'credentialless' to allow cross-origin iframes without CORP headers
          },
        ],
      },
    ];
  },
};

export default nextConfig;
