import type { Metadata } from "next";
import LandingPageClient from "./landing/LandingPageClient";

export const metadata: Metadata = {
  title: "Tockli - Focus timer and task board",
  description:
    "Tockli connects a calm task board, focus timer, session notes, sharing, and analytics for deep work.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Tockli - Focus timer and task board",
    description:
      "Plan the work, run the timer, and keep useful proof of each focus session.",
    images: ["/og.png"],
    url: "/",
  },
};

export default function HomePage() {
  return <LandingPageClient />;
}
