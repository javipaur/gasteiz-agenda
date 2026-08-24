import Script from "next/script";

export default function Analytics() {
  const src = process.env.NEXT_PUBLIC_ANALYTICS_URL;
  const domain = process.env.NEXT_PUBLIC_ANALYTICS_DATA_DOMAIN;

  if (!src) return null;

  return (
    <Script
      src={src}
      strategy="afterInteractive"
      {...(domain ? { "data-domain": domain } : {})}
      defer
    />
  );
}
