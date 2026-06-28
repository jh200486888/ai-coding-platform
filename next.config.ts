import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['*.dev.coze.site', 'dev.agent.piyiguo.com', 'localhost'],
  serverExternalPackages: ['mysql2', 'mysql2/promise', 'ssh2', 'node-ssh'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
