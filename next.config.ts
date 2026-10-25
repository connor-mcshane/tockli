import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        destination: "/",
        permanent: true,
        source: "/landing",
      },
    ];
  },
};

export default nextConfig;
