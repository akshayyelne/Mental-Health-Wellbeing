import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",   // needed for the Docker slim image
};

export default nextConfig;
