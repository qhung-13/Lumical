import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // I00 excludes automatically generated agent instruction files.
  agentRules: false,
};

export default nextConfig;
