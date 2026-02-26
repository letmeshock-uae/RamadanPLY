import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack is the default in Next.js 16; no custom loader needed
  // because GLSL shaders are inlined as template literals in SplatRenderer.ts
  turbopack: {},
};

export default nextConfig;
