
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets a second copy of the app (e.g. for security tests / a production build) use its own build folder
  distDir: process.env.NEXT_DIST_DIR || '.next',
  poweredByHeader: false, // don't advertise the framework
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // optimized images are cached for 30 days
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com', port: '', pathname: '/**' },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/sign/**',
      },
    ],
  },
  experimental: {
    // Import only the icons / animation helpers that are used, not whole libraries
    optimizePackageImports: ['lucide-react', 'motion/react', '@tanstack/react-query'],
    serverComponentsExternalPackages: ['sharp', 'ioredis', 'nodemailer'],
  },
  // The Content-Security-Policy (with its per-request nonce) is set in src/middleware.ts.
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        // camera: identity verification; geolocation: "use my location" on the map. Everything else is off.
        { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(self), payment=(), usb=(), bluetooth=(), accelerometer=(), gyroscope=(), magnetometer=(), interest-cohort=()' },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
        { key: 'X-DNS-Prefetch-Control', value: 'off' },
        { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
      ],
    },
  ],
}

export default nextConfig
