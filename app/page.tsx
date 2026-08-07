import type { Metadata } from "next";
import { getSiteUrl, siteConfig } from "@/lib/marketing";
import LandingPageClient from "./landing/LandingPageClient";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  title: "Tockli - Focus timer and task board",
  description: siteConfig.description,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Tockli - Focus timer and task board",
    description: siteConfig.description,
    images: ["/og.png"],
    url: "/",
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "@id": `${siteUrl}/#software`,
      name: siteConfig.name,
      description: siteConfig.description,
      url: siteUrl,
      applicationCategory: "ProductivityApplication",
      operatingSystem: "Web",
      image: `${siteUrl}${siteConfig.ogImage}`,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "GBP",
        url: `${siteUrl}/signup`,
      },
      publisher: {
        "@id": `${siteUrl}/#organization`,
      },
    },
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: siteConfig.name,
      url: siteUrl,
      logo: `${siteUrl}/favicon.svg`,
      description: siteConfig.description,
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <LandingPageClient />
    </>
  );
}
