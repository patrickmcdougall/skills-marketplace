import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/browse", destination: "/skills", permanent: true },
      { source: "/publishers", destination: "/creators", permanent: true },
      { source: "/publishers/:handle", destination: "/creators/:handle", permanent: true },
    ];
  },
};

export default nextConfig;
