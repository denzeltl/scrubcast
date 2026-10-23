import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@xenova/transformers", "onnxruntime-node"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
