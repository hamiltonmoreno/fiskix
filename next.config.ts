import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // turbopack is now stable via --turbopack flag in dev
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
  },
};

export default nextConfig;
