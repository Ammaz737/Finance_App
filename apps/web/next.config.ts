import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: [
    "@finance/design-system",
    "@finance/api-client",
    "@finance/permissions",
    "@finance/feature-flags",
  ],
  async rewrites() {
    const apiOrigin = process.env.API_ORIGIN ?? "http://localhost:3001";
    return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }];
  },
};

export default config;
