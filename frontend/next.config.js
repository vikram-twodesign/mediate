/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  distDir: 'out',
  images: {
    unoptimized: true
  },
  trailingSlash: true,
  // Fix static generation for App Router
  experimental: {
    // Remove the appDir option since it's no longer valid
  }
}

module.exports = nextConfig 