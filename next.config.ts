import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  agentRules: false,
  transpilePackages: ["@emoji-mart/react", "emoji-mart"],
};

export default nextConfig;
