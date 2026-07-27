import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock3, TimerReset } from "lucide-react";
import Link from "next/link";
import { getBlogArticle, blogArticles } from "@/lib/marketing";

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
    alternates: {
      canonical: `/blog/${article.slug}`,
    },
    keywords: article.keywords,
    openGraph: {
      title: article.title,
      description: article.description,
      images: ["/og.png"],
      type: "article",
      publishedTime: article.publishedAt,
      url: `/blog/${article.slug}`,
    },
  };
}

export default async function BlogArticlePage({ params }: BlogArticlePageProps) {
  const { slug } = await params;
  const article = getBlogArticle(slug);

  if (!article) {
    notFound();
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    datePublished: article.publishedAt,
    description: article.description,
    headline: article.title,
    keywords: article.keywords.join(", "),
  };

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-[#1a1c1b]">
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        type="application/ld+json"
      />
      <header className="border-b border-[#e8e8e6] bg-white px-4 md:px-8">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between">
          <Link className="flex items-center gap-3" href="/landing">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#ff005e] text-white">
              <TimerReset size={20} aria-hidden="true" />
            </span>
            <span className="text-lg font-semibold">Tockli</span>
          </Link>
          <Link
            className="flex h-10 items-center gap-2 rounded-md border border-[#e8e8e6] bg-white px-4 text-sm font-semibold text-[#62605b] transition hover:border-[#ff005e] hover:text-[#ff005e]"
            href="/blog"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Blog
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-4 py-14 md:px-8">
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase text-[#6a6965]">
          <span>{article.category}</span>
          <span className="h-1 w-1 rounded-full bg-[#d8d7d3]" />
          <span className="flex items-center gap-1">
            <Clock3 size={14} aria-hidden="true" />
            {article.readMinutes} min read
          </span>
          <span className="h-1 w-1 rounded-full bg-[#d8d7d3]" />
          <time dateTime={article.publishedAt}>
            {new Date(`${article.publishedAt}T12:00:00`).toLocaleDateString("en", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </time>
        </div>

        <h1 className="mt-5 text-4xl font-semibold leading-tight sm:text-5xl">
          {article.title}
        </h1>
        <p className="mt-5 text-xl leading-8 text-[#62605b]">
          {article.description}
        </p>

        <div className="mt-10 space-y-10 border-t border-[#e8e8e6] pt-10">
          {article.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-2xl font-semibold">{section.heading}</h2>
              <div className="mt-4 space-y-4 text-base leading-8 text-[#4f4d49]">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
