import type { Metadata } from "next";
import LandingPageClient from "./LandingPageClient";

export const metadata: Metadata = {
  title: "Tockli - Focus timer and task board",
  description:
    "Tockli connects a calm task board, focus timer, session notes, sharing, and analytics for deep work.",
  alternates: {
    canonical: "/landing",
  },
  openGraph: {
    title: "Tockli - Focus timer and task board",
    description:
      "Plan the work, run the timer, and keep useful proof of each focus session.",
    images: ["/og.png"],
    url: "/landing",
  },
};

export default function LandingPage() {
  return <LandingPageClient />;
}
