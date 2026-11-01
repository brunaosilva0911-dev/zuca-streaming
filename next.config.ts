import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.faz-o-eli.online" },
      { protocol: "https", hostname: "imagecache.365scores.com" },
      { protocol: "https", hostname: "*.embedtv.cc" },
      { protocol: "https", hostname: "embedtv.cc" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
};

export default nextConfig;
