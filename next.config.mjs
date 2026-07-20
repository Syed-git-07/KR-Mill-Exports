/** @type {import('next').NextConfig} */
const nextConfig = {
  // Base path for Apache proxy (disabled for local development)
  // basePath: '/kr-production-app',
  
  // Ensure trailing slashes for proper routing
  trailingSlash: true,
  
  // Output as standalone for easier deployment
  output: 'standalone',

  // Disable Next.js built-in CSS optimizer (lightningcss) to prevent false
  // warnings on Tailwind print: variant classes like .print\:hidden
  experimental: {
    optimizeCss: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/dr8csfvlj/image/upload/**',
      },
    ],
  },
};

export default nextConfig;
