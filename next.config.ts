import type { NextConfig } from "next";

// Sent with every response. There's deliberately no frame-ancestors / X-Frame-Options:
// Hugging Face Spaces shows apps inside an iframe on huggingface.co.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nothing here needs these; the YouTube player keeps autoplay/fullscreen/encrypted-media
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  // Only takes effect over HTTPS, which every production host provides
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node", "sharp"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
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
