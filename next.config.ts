import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  agentRules: false,
  transpilePackages: ["emoji-mart"],
};

export default nextConfig;
