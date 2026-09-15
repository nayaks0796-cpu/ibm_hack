import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // PWA manifest is in public/manifest.json
  // UI language is chosen in setup and stored on-device. No locale URL prefix.
  webpack: (config, { dev }) => {
    if (dev) {
      // Windows file locks corrupt Next's on-disk webpack pack cache and blank the app.
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
