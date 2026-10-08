import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  // Template dan font sertifikat dibaca dari disk saat runtime, bukan diimpor.
  outputFileTracingIncludes: {
    "/api/certificates/**": ["./src/lib/certificate-assets/**/*"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
export default config;
