const fallbackSiteUrl = "https://tockli.app";

function resolveSiteUrl(value: string | undefined) {
  const candidate = value?.trim() || fallbackSiteUrl;

  try {
    return new URL(candidate).origin;
  } catch {
    return fallbackSiteUrl;
  }
}

export const siteConfig = {
  name: "Tockli",
  url: resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL),
  description:
    "A calm focus timer and task board to help you get things done.",
  ogImage: "/og.png",
};

export function getSiteUrl() {
  return siteConfig.url;
}

export type BlogArticle = {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  readMinutes: number;
  category: string;
  keywords: string[];
  sections: Array<{
    heading: string;
    body: string[];
  }>;
};

export const blogArticles: BlogArticle[] = [
  {
    slug: "focus-timer-with-a-task-board",
    title: "Why a focus timer works better when it starts from your task board",
    description:
      "A practical way to connect planned work, active focus, and useful session notes without turning productivity into admin.",
    publishedAt: "2026-07-24",
    readMinutes: 4,
    category: "Focus Systems",
    keywords: ["focus timer", "task board", "deep work", "pomodoro"],
    sections: [
      {
        heading: "Start with the work, then start the clock",
        body: [
          "Most timers ask for a duration first. That is useful, but it leaves the real decision somewhere else: what are you protecting the next block for?",
          "Tockli keeps the board and timer close together so the next session starts from a concrete task. The timer is not a separate ritual. It is the moment a card becomes active work.",
        ],
      },
      {
        heading: "Measure progress without collecting noise",
        body: [
          "A finished session should leave behind the task, the time, and the note that helps tomorrow. That is enough to spot momentum without building a reporting habit that competes with the work.",
          "The early analytics view focuses on minutes, completion rate, and recent session notes. Those are the numbers most likely to change what you do next.",
        ],
      },
      {
        heading: "Keep the system small enough to trust",
        body: [
          "A good focus tool should not require a second focus tool to manage it. Categories, tags, subtasks, and daily goals give structure, while the product stays close to a simple loop: choose a card, focus, save the session, review the pattern.",
        ],
      },
    ],
  },
  {
    slug: "build-better-personal-habits",
    title: "Build better habits with simple daily tracking",
    description:
      "Your productivity system doesn't need to be complicated. A simple board and a focus timer are enough to build momentum.",
    publishedAt: "2026-07-24",
    readMinutes: 3,
    category: "Productivity",
    keywords: ["personal productivity", "habits", "focus sessions"],
    sections: [
      {
        heading: "Keep your workflow simple",
        body: [
          "Many tools overcomplicate the simple act of doing work. You don't need endless sub-menus to focus.",
          "Tockli is built for you, giving you a clean space to capture your next task and focus on it deeply.",
        ],
      },
      {
        heading: "Visible focus beats invisible effort",
        body: [
          "When focus sessions attach to tasks, you can understand your movement without overthinking. A card shows what changed, and the session note explains what mattered.",
          "This helps you reflect on your work and start tomorrow with a clearer mind.",
        ],
      },
      {
        heading: "Stay calm and focused",
        body: [
          "You deserve a tool that gets out of the way. No noisy dashboards, just your work and the time you need to complete it.",
        ],
      },
    ],
  },
  {
    slug: "analytics-that-help-you-focus",
    title: "Focus analytics that actually help you improve",
    description:
      "A small measurement framework for personal work: track your habits, completion, and rhythm to learn what works best.",
    publishedAt: "2026-07-24",
    readMinutes: 4,
    category: "Analytics",
    keywords: ["focus analytics", "personal insights", "tracking"],
    sections: [
      {
        heading: "Pick events that describe your daily loop",
        body: [
          "A focus app does not need dozens of charts. It needs to show you when you do your best work and how your momentum builds over the week.",
          "Seeing your completed sessions helps you understand your productivity patterns.",
        ],
      },
      {
        heading: "Review your past week",
        body: [
          "Taking time at the end of the week to look at your notes and focus minutes can help you plan better for the next one.",
          "Keep it simple: Did you focus on the right things?",
        ],
      },
      {
        heading: "A personal rhythm",
        body: [
          "The goal is not to maximize time spent working, but to ensure that the time you do spend working is protected and productive.",
        ],
      },
    ],
  },
];

export function getBlogArticle(slug: string) {
  return blogArticles.find((article) => article.slug === slug);
}
