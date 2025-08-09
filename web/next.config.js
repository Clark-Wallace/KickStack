/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Enable standalone output for Docker deployment
  output: 'standalone',
  // Configure environment variables
  env: {
    NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3000',
    NEXT_PUBLIC_AUTH_BASE: process.env.NEXT_PUBLIC_AUTH_BASE || 'http://localhost:9999',
    NEXT_PUBLIC_FUNCTIONS_BASE: process.env.NEXT_PUBLIC_FUNCTIONS_BASE || 'http://localhost:8787',
    NEXT_PUBLIC_REALTIME_WS: process.env.NEXT_PUBLIC_REALTIME_WS || 'ws://localhost:8081',
  },
}