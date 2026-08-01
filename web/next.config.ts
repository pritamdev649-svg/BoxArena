import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    /**
     * Venue photos only. Owners upload through our signed Cloudinary flow, so
     * that is the single host next/image is allowed to optimise — a wildcard
     * here would turn the optimiser into an open image proxy.
     */
    remotePatterns: [{ protocol: 'https', hostname: 'res.cloudinary.com' }],
  },
};

export default nextConfig;
