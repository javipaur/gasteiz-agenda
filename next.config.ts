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
      { protocol: "https", hostname: "javierpalacio.es", pathname: "/datos/**" },
      { protocol: "https", hostname: "gasteizclick.javierpalacio.es", pathname: "/datos/**" },
      { protocol: "https", hostname: "via.placeholder.com", pathname: "/**" },
      { protocol: "https", hostname: "www.cm-gazteiz.com", pathname: "/**" },
      { protocol: "https", hostname: "www.buscametas.com", pathname: "/**" },
      { protocol: "https", hostname: "www.vitoria-gasteiz.org", pathname: "/**" },
      { protocol: "https", hostname: "florida.reservaentradas.com", pathname: "/**" },
      { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "picsum.photos", pathname: "/**" },
      { protocol: "https", hostname: "sarrerak.jimmyjazzgasteiz.com", pathname: "/**" },
      { protocol: "https", hostname: "app.vamcultura.es", pathname: "/**" },
      { protocol: "https", hostname: "www.kulturklik.euskadi.eus", pathname: "/**" },
      { protocol: "https", hostname: "opendata.euskadi.eus", pathname: "/**" },
      { protocol: "https", hostname: "api.euskadi.eus", pathname: "/**" },
      { protocol: "https", hostname: "lagenterula.com", pathname: "/**" },
      { protocol: "https", hostname: "www.gasteizhoy.com", pathname: "/**" },
      { protocol: "https", hostname: "feverup.com", pathname: "/**" },
      { protocol: "https", hostname: "cofalava.org", pathname: "/**" },
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      { protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" },
      { protocol: "https", hostname: "cdn.eventbrite.com", pathname: "/**" },
      { protocol: "https", hostname: "assets.feverup.com", pathname: "/**" },
      { protocol: "https", hostname: "multimedia.feverup.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;
