import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'javierpalacio.es',
        pathname: '/datos/**',
      },
      {
        protocol: "https",
        hostname: "javierpalacio.es",
        pathname: "/datos/**",
      },
      {
        protocol: "https",
        hostname: "via.placeholder.com",
        pathname: "/**",
      },
      {
        protocol: 'https',
        hostname: 'javierpalacio.es',
        pathname: '/datos/**',
      },
      {
        protocol: 'https',
        hostname: 'gasteizclick.javierpalacio.es',
        pathname: '/datos/**',
      },
      {
        protocol: 'https',
        hostname: 'www.cm-gazteiz.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.buscametas.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.vitoria-gasteiz.org',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'florida.reservaentradas.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'sarrerak.jimmyjazzgasteiz.com',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;