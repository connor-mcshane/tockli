"use client";

import {
  ArrowRight,
  BarChart3,
  Clock3,
  FolderKanban,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import MarketingFooter from "@/app/MarketingFooter";
import MarketingHeader from "@/app/MarketingHeader";
import { trackEvent } from "@/lib/analytics";
import { getExperimentVariant, landingHeroExperiment } from "@/lib/experiments";

type LandingHeroVariant = (typeof landingHeroExperiment.variants)[number];

const focusLoop = [
  {
    title: "Choose",
    description: "Start from the card that matters now.",
    icon: FolderKanban,
  },
  {
    title: "Focus",
    description: "Commit to one protected block of time.",
    icon: Clock3,
  },
  {
    title: "Review",
    description: "Keep the note and see where your time went.",
    icon: BarChart3,
  },
];

export default function LandingPageClient() {
  const [variant, setVariant] = useState<LandingHeroVariant>(
    landingHeroExperiment.variants[0],
  );

  useEffect(() => {
    const assignedVariant = getExperimentVariant(landingHeroExperiment);
    window.requestAnimationFrame(() => setVariant(assignedVariant));
    trackEvent("page_view", { surface: "landing" });
    trackEvent("experiment_viewed", {
      experiment_id: landingHeroExperiment.id,
      variant: assignedVariant.id,
      surface: "landing",
    });
  }, []);

  function trackCta(cta: string, destination: string) {
    trackEvent("cta_clicked", {
      cta,
      destination,
      experiment_id: landingHeroExperiment.id,
      variant: variant.id,
      surface: "landing",
    });
  }

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-[#1a1c1b]">
      <MarketingHeader />

      <section className="overflow-hidden border-b border-[#e8e8e6] px-4 py-14 md:px-8 md:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-5xl font-semibold leading-none text-[#111312] sm:text-6xl lg:text-7xl">
              Tockli
            </h1>
            <p className="mt-5 text-3xl font-semibold leading-tight text-[#1a1c1b] sm:text-4xl">
              {variant.headline}
            </p>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-[#4f4d49]">
              A personal task board and focus timer that keeps planning, deep
              work, and session notes in one quiet place.
            </p>
            <div className="mt-8 flex items-center justify-center">
              <Link
                className="flex h-12 items-center gap-2 rounded-md bg-[#ff005e] px-5 text-sm font-semibold text-white transition hover:bg-[#e00054]"
                href="/signup"
                onClick={() => trackCta("hero_signup", "/signup")}
              >
                {variant.cta}
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="mx-auto mt-12 max-w-5xl overflow-hidden rounded-lg border border-[#dededa] bg-white p-2 shadow-[0_18px_50px_rgba(26,28,27,0.10)] md:p-3">
            <div className="relative aspect-video overflow-hidden rounded-md border border-[#ececea] bg-[#f7f7f5]">
              <Image
                alt="Tockli task board with task columns, focus cards, and daily progress."
                className="object-cover object-center"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 1024px"
                src="/tockli-preview.png"
              />
            </div>
          </div>
        </div>
      </section>

      <section
        className="border-b border-[#e8e8e6] bg-white px-4 py-10 md:px-8"
        id="how-it-works"
      >
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-3">
          {focusLoop.map((step) => {
            const Icon = step.icon;

            return (
              <div key={step.title} className="flex items-start gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#fff0f5] text-[#ff005e]">
                  <Icon size={19} aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-base font-semibold">{step.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-[#62605b]">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
