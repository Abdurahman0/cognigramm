import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["@heroicons/react", "date-fns"]
  }
};

export default nextConfig;
