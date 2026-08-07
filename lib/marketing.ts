const fallbackSiteUrl = "https://tockli.com";

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
    "Tockli is a task board with a focus timer built in. Run focus sessions, finish cards, and find out your focus score.",
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
    slug: "lightweight-sharing-for-small-teams",
    title: "Lightweight sharing is enough for many focus-heavy teams",
    description:
      "Shared projects do not always need enterprise process. Sometimes a common board, visible ownership, and calm focus blocks are the useful layer.",
    publishedAt: "2026-07-24",
    readMinutes: 3,
    category: "Team Focus",
    keywords: ["shared projects", "team productivity", "focus sessions"],
    sections: [
      {
        heading: "Not every shared project needs a heavyweight workspace",
        body: [
          "Small launch teams often need one shared lane of work, not another full operating system. A shared Tockli project is designed for that middle ground.",
          "The free-plan guard starts with one shared project because the product should prove that small collaborative focus is worth protecting before it grows into plan complexity.",
        ],
      },
      {
        heading: "Visible focus beats invisible effort",
        body: [
          "When focus sessions attach to tasks, teammates can understand movement without asking for a status update. A card shows what changed, and the session note explains what mattered.",
          "That makes async collaboration a little quieter. The app creates context at the moment work happens.",
        ],
      },
      {
        heading: "The backend path is ready for the next pass",
        body: [
          "The Supabase schema already models profiles, project members, tasks, tags, subtasks, focus sessions, and user settings. That gives the shared project idea a real persistence path when authentication is connected.",
        ],
      },
    ],
  },
  {
    slug: "analytics-that-help-you-focus",
    title: "Focus analytics should answer what to do next",
    description:
      "A small measurement framework for focus work: track intent, completion, and rhythm before adding dashboards nobody uses.",
    publishedAt: "2026-07-24",
    readMinutes: 4,
    category: "Analytics",
    keywords: ["focus analytics", "product analytics", "event tracking"],
    sections: [
      {
        heading: "Pick events that describe the product loop",
        body: [
          "A focus app does not need dozens of charts on day one. It needs to know whether people create tasks, start timers, complete sessions, and return to useful notes.",
          "Those events map directly to the product promise. They also make onboarding and pricing experiments easier to read later.",
        ],
      },
      {
        heading: "Separate product analytics from marketing analytics",
        body: [
          "Marketing events explain how someone arrived and which message earned a signup. Product events explain whether Tockli became part of their workday.",
          "Keeping those names explicit now prevents a muddy event stream when the landing page, signup flow, and app are all live.",
        ],
      },
      {
        heading: "A/B testing can stay humble",
        body: [
          "The first experiment should be narrow: one landing-page headline or one signup call to action. Deterministic assignment and exposure tracking are enough to learn without adding a heavy experimentation service.",
        ],
      },
    ],
  },
];

export function getBlogArticle(slug: string) {
  return blogArticles.find((article) => article.slug === slug);
}
