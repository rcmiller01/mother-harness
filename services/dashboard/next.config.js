/** @type {import('next').NextConfig} */
const nextConfig = {
    eslint: {
        ignoreDuringBuilds: true,
    },
    reactStrictMode: true,
    output: 'standalone',
    // Enable experimental features for server components
    experimental: {
        serverComponentsExternalPackages: ['ioredis'],
    },
    // API rewrites to orchestrator
    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: `${process.env.ORCHESTRATOR_URL || 'http://localhost:8000'}/api/:path*`,
            },
        ];
    },
};

module.exports = nextConfig;
