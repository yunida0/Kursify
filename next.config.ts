import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer", "exceljs"],
  eslint: {
    ignoreDuringBuilds: false,
  },
  experimental: {
    // Form pendaftaran mengunggah beberapa lampiran sekaligus.
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
