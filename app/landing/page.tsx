import type { Metadata } from "next";
import LandingPageClient from "./LandingPageClient";

export const metadata: Metadata = {
  title: "Tockli - Focus timer and task board",
  description:
    "Tockli is a calm task board and focus timer to help you get things done.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Tockli - Focus timer and task board",
    description:
      "Plan your day, start the timer, and focus on what matters.",
    images: ["/og.png"],
    url: "/",
  },
};

export default function LandingPage() {
  return <LandingPageClient />;
}
