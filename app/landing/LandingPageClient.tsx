"use client";

import {
  ArrowRight,
  BarChart3,
  Clock3,
  FolderKanban,
  TimerReset,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
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

      <footer
        className="scroll-mt-6 bg-[#171918] px-4 py-12 text-white md:px-8"
        id="about"
      >
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
            <div className="max-w-sm">
              <Link
                className="flex w-fit items-center gap-3"
                href="/"
                onClick={() => trackCta("footer_logo", "/")}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#ff005e] text-white">
                  <TimerReset size={20} aria-hidden="true" />
                </span>
                <span className="text-lg font-semibold">Tockli</span>
              </Link>
              <p className="mt-5 text-sm leading-6 text-[#b9bcb9]">
                A personal task board, committed focus timer, and useful record
                of where your time went.
              </p>
            </div>

            <div>
              <h2 className="text-sm font-semibold">Product</h2>
              <ul className="mt-4 space-y-3 text-sm text-[#b9bcb9]">
                <li>Personal task boards</li>
                <li>Committed focus timers</li>
                <li>Session notes and analytics</li>
              </ul>
            </div>

            <div>
              <h2 className="text-sm font-semibold">About Tockli</h2>
              <p className="mt-4 max-w-sm text-sm leading-6 text-[#b9bcb9]">
                Tockli is independently designed and built for people who want
                to plan clearly, commit to focused time, and keep a useful
                record of their work without enterprise overhead.
              </p>
            </div>
          </div>

          <div className="mt-12 flex flex-col gap-2 border-t border-white/15 pt-6 text-xs text-[#8e928e] sm:flex-row sm:items-center sm:justify-between">
            <p>© 2026 Tockli.</p>
            <p>Personal productivity, without the admin.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
