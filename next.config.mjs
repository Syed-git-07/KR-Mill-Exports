/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,
  // The application is hosted below the main krexports.org site.
  basePath: '/kr-production-app',
  
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
