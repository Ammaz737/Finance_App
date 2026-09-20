import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: [
    "@finance/design-system",
    "@finance/api-client",
    "@finance/permissions",
    "@finance/feature-flags",
  ],
};

export default config;
