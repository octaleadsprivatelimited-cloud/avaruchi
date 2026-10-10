import type { NextConfig } from "next";
import { securityHeaders } from "./lib/security-headers";
const config: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["mysql2"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: Object.entries(securityHeaders).map(([key, value]) => ({
          key,
          value,
        })),
      },
    ];
  },
};
export default config;
