// next.config.ts
import type { NextConfig } from 'next';
const withPWA: any = require('next-pwa');

const nextConfig: NextConfig = {
  // Disable Turbopack, use Webpack (stable)
  // Remove all "turbo" flags
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'traderiser-storage.s3.amazonaws.com',
        port: '',
        pathname: '/assets/**', // Restrict to assets folder for security
      },
      {
        protocol: 'https',
        hostname: 'traderiser-storage.s3.eu-north-1.amazonaws.com',
        port: '',
        pathname: '/assets/**', // Include region-specific hostname if used
      },
    ],
  },
};

export default withPWA({
  dest: 'public', // Output directory for the generated service worker
  disable: process.env.NODE_ENV === 'development', // Disable in development to avoid caching issues
  register: true, // Automatically register the service worker
  skipWaiting: true, // Skip waiting on install
  swSrc: 'app/sw.js', // Path to the custom service worker source file
  swDest: 'sw.js', // Output filename for the generated service worker (in public/)
})(nextConfig);