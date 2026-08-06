function normalizeBasePath(value) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "/") return "";

  const normalized = `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
  if (!/^\/[A-Za-z0-9._~/-]+$/.test(normalized)) {
    throw new Error("NEXT_PUBLIC_BASE_PATH must be an absolute URL path.");
  }
  return normalized;
}

const basePath = normalizeBasePath(
  process.env.NEXT_PUBLIC_BASE_PATH ?? "/kr-production-app",
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,
  basePath: basePath || undefined,

  // Expose the normalized build-time value to shared routing helpers.
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  
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
