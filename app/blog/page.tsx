import type { Metadata } from "next";
import { ArrowRight, Clock3 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import MarketingFooter from "@/app/MarketingFooter";
import MarketingHeader from "@/app/MarketingHeader";
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
      <MarketingHeader />

      <section className="border-b border-[#e8e8e6] bg-white px-4 py-14 md:px-8">
        <div className="mx-auto max-w-7xl">
        <p className="text-sm font-semibold uppercase text-[#b90042]">
          Tockli blog
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
          Practical notes for calmer focus work.
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-[#62605b]">
          Short, useful writing on task-first timers, lightweight collaboration,
          and analytics that make the next block clearer.
        </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-16 md:px-8">
        {blogArticles.map((article) => (
          <article
            key={article.slug}
            className="grid gap-5 overflow-hidden rounded-lg border border-[#e8e8e6] bg-white p-4 transition hover:border-[#d4d3cf] hover:shadow-[0_10px_28px_rgba(26,28,27,0.08)] md:grid-cols-[minmax(220px,0.7fr)_minmax(0,1.3fr)_auto] md:items-center"
          >
            <Link
              aria-label={`Read ${article.title}`}
              className="relative block aspect-[3/2] overflow-hidden rounded-md bg-[#ececea]"
              href={`/blog/${article.slug}`}
            >
              <Image
                alt={article.imageAlt}
                className="object-cover transition duration-300 hover:scale-[1.02]"
                fill
                sizes="(min-width: 768px) 28vw, 100vw"
                src={article.image}
              />
            </Link>
            <div>
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase text-[#6a6965]">
                <span>{article.category}</span>
                <span className="h-1 w-1 rounded-full bg-[#d8d7d3]" />
                <span className="flex items-center gap-1">
                  <Clock3 size={14} aria-hidden="true" />
                  {article.readMinutes} min read
                </span>
              </div>
              <h2 className="text-2xl font-semibold leading-tight">
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
            </div>
            <Link
              className="inline-flex h-10 items-center gap-2 self-start rounded-md border border-[#e8e8e6] bg-white px-4 text-sm font-semibold text-[#1a1c1b] transition hover:border-[#ff005e] hover:text-[#ff005e]"
              href={`/blog/${article.slug}`}
            >
              Read
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </article>
        ))}
      </section>

      <MarketingFooter />
    </main>
  );
}
