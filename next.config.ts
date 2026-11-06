import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Photographs are resized at upload time (scripts/photos.mjs) and served as plain <img>,
  // so the Vercel image optimizer and its Hobby quota are not in the path.
  images: { unoptimized: true },
  devIndicators: false,
};

export default nextConfig;
