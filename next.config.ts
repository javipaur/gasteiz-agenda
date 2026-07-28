import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, x-api-key" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "javierpalacio.es",
        pathname: "/datos/**",
      },
      {
        protocol: "https",
        hostname: "gasteizclick.javierpalacio.es",
        pathname: "/datos/**",
      },
      {
        protocol: "https",
        hostname: "via.placeholder.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "www.cm-gazteiz.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "www.buscametas.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "www.vitoria-gasteiz.org",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "florida.reservaentradas.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "sarrerak.jimmyjazzgasteiz.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
