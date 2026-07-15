import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'agora.lexlatin.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
