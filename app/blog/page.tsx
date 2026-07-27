import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, Clock3, TimerReset } from "lucide-react";
import Link from "next/link";
import { blogArticles } from "@/lib/marketing";

export const metadata: Metadata = {
  title: "Tockli Blog",
  description:
    "Notes on focus timers, task boards, lightweight sharing, analytics, and building a calmer productivity workflow.",
  alternates: {
    canonical: "/blog",
  },
  openGraph: {
    title: "Tockli Blog",
    description:
      "Launch notes and practical writing about focus systems and Tockli.",
    images: ["/og.png"],
    url: "/blog",
  },
};

export default function BlogIndexPage() {
  return (
    <main className="min-h-screen bg-[#f7f7f5] text-[#1a1c1b]">
      <header className="border-b border-[#e8e8e6] bg-white px-4 md:px-8">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between">
          <Link className="flex items-center gap-3" href="/">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#ff005e] text-white">
              <TimerReset size={20} aria-hidden="true" />
            </span>
            <span className="text-lg font-semibold">Tockli</span>
          </Link>
          <Link
            className="flex h-10 items-center gap-2 rounded-md border border-[#e8e8e6] bg-white px-4 text-sm font-semibold text-[#62605b] transition hover:border-[#ff005e] hover:text-[#ff005e]"
            href="/"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Landing
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-14 md:px-8">
        <p className="text-sm font-semibold uppercase text-[#b90042]">
          Tockli blog
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
          Practical notes for calmer focus work.
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-[#62605b]">
          Launch articles for SEO, onboarding, and product education.
        </p>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-4 pb-16 md:px-8">
        {blogArticles.map((article) => (
          <article
            key={article.slug}
            className="rounded-lg border border-[#e8e8e6] bg-white p-5 transition hover:border-[#d4d3cf] hover:shadow-[0_10px_28px_rgba(26,28,27,0.08)]"
          >
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase text-[#6a6965]">
              <span>{article.category}</span>
              <span className="h-1 w-1 rounded-full bg-[#d8d7d3]" />
              <span className="flex items-center gap-1">
                <Clock3 size={14} aria-hidden="true" />
                {article.readMinutes} min read
              </span>
            </div>
            <h2 className="mt-4 text-2xl font-semibold leading-tight">
              <Link
                className="transition hover:text-[#ff005e]"
                href={`/blog/${article.slug}`}
              >
                {article.title}
              </Link>
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#62605b]">
              {article.description}
            </p>
            <Link
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#ff005e]"
              href={`/blog/${article.slug}`}
            >
              Read article
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </article>
        ))}
      </section>
    </main>
  );
}
