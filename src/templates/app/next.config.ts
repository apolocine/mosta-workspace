// Auto-généré par @mostajs/workspace
// Le basePath est lu depuis BASE_PATH (`/dev`, `/test`, `/prod` en mode path,
// vide en mode subdomain). Si vide → app servie à la racine.

import type { NextConfig } from 'next'

const basePath = process.env.BASE_PATH || ''

const nextConfig: NextConfig = {
  reactStrictMode: true,
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  experimental: {
    serverActions: { bodySizeLimit: '10mb' },
  },
  env: {
    BASE_PATH: basePath,
    MOSTA_ENV: process.env.MOSTA_ENV || 'dev',
  },
}

export default nextConfig
