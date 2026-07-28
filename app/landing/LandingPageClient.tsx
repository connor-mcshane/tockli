"use client";

import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  FolderKanban,
  Sparkles,
  TimerReset,
  CheckSquare,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { getExperimentVariant, landingHeroExperiment } from "@/lib/experiments";
import { blogArticles } from "@/lib/marketing";

type LandingHeroVariant = (typeof landingHeroExperiment.variants)[number];

const featureCards = [
  {
    title: "Task-first focus",
    description: "Pick a task first, then start the timer to protect your focus.",
    icon: FolderKanban,
  },
  {
    title: "Clean session notes",
    description: "Save your thoughts, links, or next steps while the context is fresh.",
    icon: Clock3,
  },
  {
    title: "Simple task tracking",
    description: "Keep track of your personal tasks without the overhead of complex tools.",
    icon: CheckSquare,
  },
  {
    title: "Personal insights",
    description: "See your completion, focus minutes, and notes to reflect on your day.",
    icon: BarChart3,
  },
];

export default function LandingPageClient() {
  const [variant, setVariant] = useState<LandingHeroVariant>(
    landingHeroExperiment.variants[0],
  );
  const featuredArticles = useMemo(() => blogArticles.slice(0, 3), []);

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
      <header className="sticky top-0 z-30 border-b border-[#e8e8e6] bg-white/[0.92] px-4 backdrop-blur md:px-8">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4">
          <Link
            className="flex items-center gap-3"
            href="/"
            onClick={() => trackCta("logo", "/")}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#ff005e] text-white">
              <TimerReset size={20} aria-hidden="true" />
            </span>
            <span className="text-lg font-semibold">Tockli</span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-semibold text-[#62605b] md:flex">
            <a className="transition hover:text-[#ff005e]" href="#features">
              Features
            </a>
            <Link className="transition hover:text-[#ff005e]" href="/blog">
              Blog
            </Link>
            <Link className="transition hover:text-[#ff005e]" href="/app">
              App
            </Link>
            <Link className="transition hover:text-[#ff005e]" href="/login">
              Log in
            </Link>
          </nav>

          <Link
            className="flex h-10 items-center gap-2 rounded-md bg-[#ff005e] px-4 text-sm font-semibold text-white transition hover:bg-[#e00054]"
            href="/signup"
            onClick={() => trackCta("header_signup", "/signup")}
          >
            Get started
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <section className="relative min-h-[82svh] overflow-hidden border-b border-[#e8e8e6]">
        <Image
          alt="Tockli task board with focus cards, project navigation, and daily focus progress."
          className="absolute inset-0 h-full w-full object-cover object-center"
          fill
          priority
          sizes="100vw"
          src="/tockli-preview.png"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(247,247,245,0.96)_0%,rgba(247,247,245,0.9)_42%,rgba(247,247,245,0.48)_100%)]" />
        <div className="relative mx-auto flex min-h-[82svh] max-w-7xl items-center px-4 py-16 md:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase text-[#b90042]">
              {variant.eyebrow}
            </p>
            <h1 className="mt-3 text-5xl font-semibold leading-[1.02] text-[#111312] sm:text-6xl lg:text-7xl">
              Tockli
            </h1>
            <p className="mt-5 max-w-2xl text-3xl font-semibold leading-tight text-[#1a1c1b] sm:text-4xl">
              {variant.headline}
            </p>
            <p className="mt-5 max-w-xl text-lg leading-8 text-[#4f4d49] sm:text-xl">
              Tockli brings your task board, focus timer, notes, and daily
              rhythm into one calm app for getting things done.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                className="flex h-12 items-center gap-2 rounded-md bg-[#ff005e] px-5 text-sm font-semibold text-white transition hover:bg-[#e00054]"
                href="/signup"
                onClick={() => trackCta("hero_signup", "/signup")}
              >
                {variant.cta}
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link
                className="flex h-12 items-center gap-2 rounded-md border border-[#d8d7d3] bg-white px-5 text-sm font-semibold text-[#1a1c1b] transition hover:border-[#ff005e] hover:text-[#ff005e]"
                href="/app"
                onClick={() => trackCta("hero_open_app", "/app")}
              >
                Open the app
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-2 text-sm font-semibold text-[#4f4d49]">
              {["A clean, peaceful interface", "Save your thoughts", "Built for your personal workflow"].map(
                (item) => (
                  <span
                    key={item}
                    className="rounded-md border border-[#e1e0dc] bg-white/80 px-3 py-2"
                  >
                    {item}
                  </span>
                ),
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#e8e8e6] bg-white px-4 py-14 md:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-4">
          {[
            ["25", "minute default focus block"],
            ["1", "personal focus board"],
            ["7", "day rhythm snapshot"],
            ["0", "distractions to run a session"],
          ].map(([value, label]) => (
            <div key={label} className="border-l-2 border-[#ff005e] pl-4">
              <div className="text-3xl font-semibold">{value}</div>
              <div className="mt-1 text-sm text-[#62605b]">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="px-4 py-16 md:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase text-[#b90042]">
              Built around the work
            </p>
            <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">
              The loop is simple: choose, focus, save, review.
            </h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {featureCards.map((feature) => {
              const Icon = feature.icon;

              return (
                <article
                  key={feature.title}
                  className="rounded-lg border border-[#e8e8e6] bg-white p-5"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#fff0f5] text-[#ff005e]">
                    <Icon size={20} aria-hidden="true" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#62605b]">
                    {feature.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-y border-[#e8e8e6] bg-white px-4 py-16 md:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase text-[#b90042]">
                App preview
              </p>
              <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">
                Your plan and your timer stay on the same screen.
              </h2>
            </div>
            <Link
              className="flex h-10 items-center gap-2 rounded-md border border-[#e8e8e6] bg-white px-4 text-sm font-semibold text-[#1a1c1b] transition hover:border-[#ff005e] hover:text-[#ff005e]"
              href="/app"
              onClick={() => trackCta("preview_open_app", "/app")}
            >
              Try the app
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-8 overflow-hidden rounded-lg border border-[#d8d7d3] bg-[#f7f7f5] shadow-[0_18px_60px_rgba(26,28,27,0.12)]">
            <Image
              alt="A Tockli app screen showing tasks, a focus timer, notes, and focus analytics."
              className="h-auto w-full"
              height={720}
              sizes="(min-width: 1280px) 1152px, 100vw"
              src="/tockli-preview.png"
              width={1280}
            />
          </div>
        </div>
      </section>

      <section className="border-b border-[#e8e8e6] bg-[#1a1c1b] px-4 py-16 text-white md:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
          <div>
            <p className="text-sm font-semibold uppercase text-[#ff9cbd]">
              Designed to stay calm
            </p>
            <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">
              Your personal productivity helper.
            </h2>
            <p className="mt-4 text-lg leading-8 text-[#d8d7d3]">
              Use Tockli when you need a clear next step, a visible task, and
              a short note that makes tomorrow easier.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              "Task board and timer together",
              "Session notes with context",
              "Your personal focus history",
              "Daily rhythm without clutter",
              "Fast signup and login",
              "Made for individuals",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm">
                <CheckCircle2 className="text-[#25d67c]" size={18} aria-hidden="true" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 md:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase text-[#b90042]">
                Field notes
              </p>
              <h2 className="mt-2 text-3xl font-semibold">Productivity Tips</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[#62605b]">
                Short articles on focus systems, personal productivity, and building
                better habits for deep work.
              </p>
            </div>
            <Link
              className="flex h-10 items-center gap-2 rounded-md border border-[#e8e8e6] bg-white px-4 text-sm font-semibold text-[#1a1c1b] transition hover:border-[#ff005e] hover:text-[#ff005e]"
              href="/blog"
              onClick={() => trackCta("blog_index", "/blog")}
            >
              View all
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {featuredArticles.map((article) => (
              <article
                key={article.slug}
                className="rounded-lg border border-[#e8e8e6] bg-white p-5"
              >
                <div className="flex items-center gap-2 text-xs font-semibold uppercase text-[#6a6965]">
                  <Sparkles size={14} aria-hidden="true" />
                  {article.category}
                </div>
                <h3 className="mt-4 text-xl font-semibold leading-tight">
                  {article.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-[#62605b]">
                  {article.description}
                </p>
                <Link
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#ff005e]"
                  href={`/blog/${article.slug}`}
                  onClick={() => trackCta("blog_article", `/blog/${article.slug}`)}
                >
                  Read article
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
