import path from 'node:path';
import type { NextConfig } from 'next';

// Miljøvariabler leses fra .env i roten av monorepoet (se dotenv i package.json-skriptene).
const config: NextConfig = {
  transpilePackages: ['@bwp/shared', '@bwp/db'],
  serverExternalPackages: ['@prisma/client'],
  turbopack: { root: path.resolve(__dirname, '../..') },
};

export default config;
