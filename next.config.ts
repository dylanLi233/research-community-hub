import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

initOpenNextCloudflareForDev();

const privateCookieHeaders = [
  {
    key: "Cache-Control",
    value: "private, no-store, max-age=0, must-revalidate",
  },
  { key: "Vary", value: "Cookie" },
  { key: "X-Content-Type-Options", value: "nosniff" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/reports/:path*",
        headers: privateCookieHeaders,
      },
      {
        source: "/events/:path*",
        headers: privateCookieHeaders,
      },
    ];
  },
};

export default nextConfig;
