import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, Clock3 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import MarketingFooter from "@/app/MarketingFooter";
import MarketingHeader from "@/app/MarketingHeader";
import {
  getBlogArticle,
  blogArticles,
  getSiteUrl,
  siteConfig,
} from "@/lib/marketing";

type BlogArticlePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return blogArticles.map((article) => ({
    slug: article.slug,
  }));
}

export async function generateMetadata({
  params,
}: BlogArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getBlogArticle(slug);

  if (!article) {
    return {
      title: "Article not found",
    };
  }

  return {
    title: article.title,
    description: article.description,
    authors: [{ name: siteConfig.name, url: getSiteUrl() }],
    alternates: {
      canonical: `/blog/${article.slug}`,
    },
    keywords: article.keywords,
    openGraph: {
      title: article.title,
      description: article.description,
      images: [article.image],
      type: "article",
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt ?? article.publishedAt,
      url: `/blog/${article.slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.description,
      images: [article.image],
    },
  };
}

export default async function BlogArticlePage({ params }: BlogArticlePageProps) {
  const { slug } = await params;
  const article = getBlogArticle(slug);

  if (!article) {
    notFound();
  }

  const siteUrl = getSiteUrl();
  const articleUrl = `${siteUrl}/blog/${article.slug}`;
  const relatedArticles = article.relatedSlugs
    .map((relatedSlug) => getBlogArticle(relatedSlug))
    .filter((relatedArticle) => relatedArticle !== undefined);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${articleUrl}#article`,
    author: {
      "@type": "Organization",
      name: siteConfig.name,
      url: siteUrl,
    },
    dateModified: `${article.updatedAt ?? article.publishedAt}T12:00:00Z`,
    datePublished: `${article.publishedAt}T12:00:00Z`,
    description: article.description,
    headline: article.title,
    image: [`${siteUrl}${article.image}`],
    keywords: article.keywords.join(", "),
    mainEntityOfPage: {
      "@id": articleUrl,
      "@type": "WebPage",
    },
    publisher: {
      "@id": `${siteUrl}/#organization`,
      "@type": "Organization",
      name: siteConfig.name,
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}/og.png`,
      },
      url: siteUrl,
    },
    url: articleUrl,
  };

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-[#1a1c1b]">
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        type="application/ld+json"
      />
      <MarketingHeader />

      <article>
        <section className="border-b border-[#e8e8e6] bg-white px-4 py-14 md:px-8">
          <div className="mx-auto max-w-3xl">
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase text-[#6a6965]">
              <span>{article.category}</span>
              <span className="h-1 w-1 rounded-full bg-[#d8d7d3]" />
              <span className="flex items-center gap-1">
                <Clock3 size={14} aria-hidden="true" />
                {article.readMinutes} min read
              </span>
              <span className="h-1 w-1 rounded-full bg-[#d8d7d3]" />
              <time dateTime={article.publishedAt}>
                {new Date(`${article.publishedAt}T12:00:00`).toLocaleDateString(
                  "en",
                  {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  },
                )}
              </time>
              <span className="h-1 w-1 rounded-full bg-[#d8d7d3]" />
              <span>By Tockli</span>
            </div>

            <h1 className="mt-5 text-4xl font-semibold leading-tight sm:text-5xl">
              {article.title}
            </h1>
            <p className="mt-5 text-xl leading-8 text-[#62605b]">
              {article.description}
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-5xl px-4 pt-10 md:px-8">
          <div className="relative aspect-[3/2] overflow-hidden rounded-xl border border-[#e1e0dc] bg-[#ececea] shadow-[0_18px_50px_rgba(26,28,27,0.10)]">
            <Image
              alt={article.imageAlt}
              className="object-cover"
              fill
              priority
              sizes="(min-width: 1024px) 960px, 100vw"
              src={article.image}
            />
          </div>
        </div>

        <div className="mx-auto max-w-3xl space-y-10 px-4 py-12 md:px-8">
          {article.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-2xl font-semibold">{section.heading}</h2>
              <div className="mt-4 space-y-4 text-base leading-8 text-[#4f4d49]">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.bullets ? (
                  <ul className="list-disc space-y-3 pl-6">
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </section>
          ))}

          <aside className="rounded-xl border border-[#ffd0de] bg-[#fff4f7] p-6">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#b90042]">
              Keep reading
            </p>
            <div className="mt-4 grid gap-3">
              {relatedArticles.map((relatedArticle) => (
                <Link
                  className="group flex items-center justify-between gap-4 rounded-md bg-white px-4 py-3 text-sm font-semibold text-[#1a1c1b] transition hover:text-[#d90050]"
                  href={`/blog/${relatedArticle.slug}`}
                  key={relatedArticle.slug}
                >
                  <span>{relatedArticle.title}</span>
                  <ArrowRight
                    aria-hidden="true"
                    className="shrink-0 transition group-hover:translate-x-0.5"
                    size={16}
                  />
                </Link>
              ))}
            </div>
          </aside>

          <aside className="rounded-xl bg-[#171918] p-7 text-white">
            <h2 className="text-2xl font-semibold">Put the next block to work.</h2>
            <p className="mt-3 max-w-xl leading-7 text-[#c9cbc9]">
              Build a small task board, run your first focus session, and see
              what actually moved this week.
            </p>
            <Link
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-md bg-[#ff005e] px-4 text-sm font-semibold text-white transition hover:bg-[#e00054]"
              href="/signup"
            >
              Get started for free
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </aside>
        </div>
      </article>

      <MarketingFooter />
    </main>
  );
}
