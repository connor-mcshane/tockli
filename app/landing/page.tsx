import type { Metadata } from "next";
import { siteConfig } from "@/lib/marketing";
import LandingPageClient from "./LandingPageClient";

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

export default function LandingPage() {
  return <LandingPageClient />;
}
