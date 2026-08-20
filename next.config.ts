import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Local browser QA commonly uses 127.0.0.1 while Next serves from localhost.
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    serverActions: {
      bodySizeLimit: '3mb',
    },
  },
};

export default nextConfig;
