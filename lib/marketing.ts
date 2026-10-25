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
  updatedAt?: string;
  readMinutes: number;
  category: string;
  keywords: string[];
  image: string;
  imageAlt: string;
  relatedSlugs: string[];
  sections: Array<{
    heading: string;
    body: string[];
    bullets?: string[];
  }>;
};

export const blogArticles: BlogArticle[] = [
  {
    slug: "focus-timer-with-a-task-board",
    title: "Why a focus timer works better when it starts from your task board",
    description:
      "A timer can protect your attention, but it cannot choose the work. Connecting it to a task board fixes that missing step.",
    publishedAt: "2026-07-24",
    updatedAt: "2026-10-25",
    readMinutes: 6,
    category: "Focus Systems",
    keywords: ["focus timer", "task board", "deep work", "pomodoro"],
    image: "/blog/pomodoro-task-board.jpg",
    imageAlt:
      "A paper task board with one selected card beside a pink-accented focus timer.",
    relatedSlugs: ["pomodoro-task-board-setup", "focus-timer-vs-to-do-list"],
    sections: [
      {
        heading: "A timer solves the second problem",
        body: [
          "Opening a timer feels productive because it gives you a clean button to press. But the hard part usually happened a few seconds earlier: deciding what deserves the next half hour. If that decision is still sitting in another tab, the timer starts with a wobble.",
          "A task-first timer removes the wobble. Pick a card, make sure it describes a finishable piece of work, then start the clock from that card. The session now has a subject. You are not focusing in the abstract; you are finishing the draft, checking the numbers, or fixing the broken state.",
        ],
      },
      {
        heading: "Write cards that can survive a focus block",
        body: [
          "A card called ‘website’ is a bucket, not a task. The timer cannot rescue it. A better card names the next visible result: ‘rewrite the pricing-page headline’ or ‘compress the homepage images.’ You should be able to look at the card when the bell goes and say whether it moved.",
          "This also makes estimates less theatrical. You do not need to predict the whole project. Decide whether this card is roughly one session, two sessions, or too large to start. Split it if it is too large.",
        ],
      },
      {
        heading: "Let the board change when the work changes",
        body: [
          "Move the card into progress when the session begins. When the session ends, finish it, write a short note, or leave it where it is with a clearer next step. That tiny bit of housekeeping matters because the board stays believable.",
          "Do not turn the session note into a diary. One useful line is enough: what changed, what is blocked, or where to restart. Tomorrow-you needs a handhold, not a transcript.",
        ],
      },
      {
        heading: "Keep one visible commitment",
        body: [
          "The board can hold a hundred cards. The timer should hold one. That constraint is the point. It prevents a focus session from becoming another container for five competing intentions.",
          "If you finish early, stop and choose again. Quietly drifting into a second task makes the history less useful and usually smuggles distraction back into the block.",
        ],
      },
    ],
  },
  {
    slug: "lightweight-sharing-for-small-teams",
    title: "Lightweight sharing is enough for many focus-heavy teams",
    description:
      "Small teams often need a shared view of the work, not another system that demands constant tending.",
    publishedAt: "2026-07-24",
    updatedAt: "2026-10-25",
    readMinutes: 5,
    category: "Team Focus",
    keywords: ["shared projects", "team productivity", "focus sessions"],
    image: "/blog/shared-focus-board.jpg",
    imageAlt:
      "Two people moving paper cards on a shared board beside a focus timer.",
    relatedSlugs: ["focus-timer-with-a-task-board", "pomodoro-task-board-setup"],
    sections: [
      {
        heading: "A shared board should answer three questions",
        body: [
          "What is moving? Who owns the next step? Where is something stuck? If a board answers those questions, a two-person project can get through most days without a status meeting.",
          "Trouble starts when the board tries to capture every conversation and decision. It gets heavier, people stop updating it, and everyone returns to asking in chat. Keep the board for work state. Put long discussions somewhere built for discussion.",
        ],
      },
      {
        heading: "Ownership needs to be specific",
        body: [
          "A card with two owners often has no owner. Give one person responsibility for moving it, even when several people contribute. That does not mean they do every part; it means the team knows who can answer the next question.",
          "Use viewer access for people who need context and editor access for people who change the work. Permissions should mirror the actual relationship, not flatter everyone with admin rights.",
        ],
      },
      {
        heading: "Share the outcome, not the surveillance",
        body: [
          "Focus time is personal. A teammate needs to know that the card advanced, not whether you touched the mouse every three minutes. Attach the useful result to the card and leave the rest alone.",
          "A short session note can replace a surprising amount of reporting: ‘Draft is ready; legal wording still needs a check.’ That is enough context for the next person to act.",
        ],
      },
      {
        heading: "A five-minute weekly reset",
        body: [
          "Once a week, archive finished cards, return abandoned work to the backlog, and split anything that has been in progress for too long. Then stop. A board that needs a forty-minute grooming ceremony has already won the wrong battle.",
        ],
      },
    ],
  },
  {
    slug: "analytics-that-help-you-focus",
    title: "Focus analytics should answer what to do next",
    description:
      "Minutes are easy to count and easy to misread. Useful focus analytics point to a change you can make next week.",
    publishedAt: "2026-07-24",
    updatedAt: "2026-10-25",
    readMinutes: 6,
    category: "Analytics",
    keywords: ["focus analytics", "product analytics", "event tracking"],
    image: "/blog/weekly-focus-score.jpg",
    imageAlt:
      "A hand-drawn weekly focus review with check marks and a simple score dial.",
    relatedSlugs: ["how-to-calculate-focus-score", "focus-timer-with-a-task-board"],
    sections: [
      {
        heading: "Hours are not the same as progress",
        body: [
          "A twelve-hour day can be a sign of commitment. It can also be a sign that the work was unclear, interrupted, or badly scoped. Raw minutes cannot tell you which version happened.",
          "Start with questions that lead somewhere: Did I show up on the days I meant to work? Did I finish the sessions I started? Did any cards actually reach done? Those answers are less impressive on a dashboard and much more useful on Monday morning.",
        ],
      },
      {
        heading: "Read the pattern, not the verdict",
        body: [
          "A low week is information, not a character assessment. Maybe you planned five workdays during a week with two days of travel. Maybe every abandoned session was a fifty-minute block that should have been twenty-five. The shape matters.",
          "Look for repetition across a few weeks before changing your system. One chaotic Tuesday is just a chaotic Tuesday.",
        ],
      },
      {
        heading: "The four numbers worth keeping",
        body: [
          "A compact review can fit on one screen. Count active workdays, days you reached your session goal, cards finished, and sessions abandoned. Each number suggests a different adjustment.",
        ],
        bullets: [
          "Few active days: make the first session easier to start.",
          "Active days but missed goals: lower the daily goal or protect a second block.",
          "Many sessions but few finished cards: split the work smaller.",
          "Frequent abandoned sessions: shorten the timer before blaming your attention span.",
        ],
      },
      {
        heading: "Review once, then get back to work",
        body: [
          "Weekly is frequent enough to catch a pattern and slow enough to avoid score-watching. Pick one adjustment for the next week. Keep the rest of the system steady so you can tell whether the change helped.",
          "Analytics should end with a decision. If the chart cannot change what you do, it is decoration.",
        ],
      },
    ],
  },
  {
    slug: "pomodoro-task-board-setup",
    title: "A Pomodoro task board setup that does not become another job",
    description:
      "A simple board-and-timer setup for turning a long list into focused sessions without spending the morning organising it.",
    publishedAt: "2026-10-25",
    readMinutes: 7,
    category: "Practical Guides",
    keywords: ["pomodoro task board", "pomodoro board", "focus task manager"],
    image: "/blog/pomodoro-task-board.jpg",
    imageAlt:
      "A simple three-column paper task board and a compact focus timer on a sunlit desk.",
    relatedSlugs: ["focus-timer-with-a-task-board", "focus-timer-vs-to-do-list"],
    sections: [
      {
        heading: "Start with four columns",
        body: [
          "Use Backlog, Today, In progress, and Done. That is enough. Extra columns feel precise, but they often hide the only distinction that matters during a focus session: am I doing this now or not?",
          "Keep Today short. Three meaningful cards is plenty for most days. The backlog can be untidy because it is storage, not a promise.",
        ],
      },
      {
        heading: "Size the card before you size the timer",
        body: [
          "The classic Pomodoro is twenty-five minutes, but there is nothing sacred about the number. Use a block that matches the work and your current energy. Twenty-five minutes is good for starting something sticky. Fifty minutes gives writing or coding room to settle.",
          "If a card cannot move in one or two blocks, split it. ‘Prepare launch’ becomes ‘draft launch email,’ ‘check signup flow,’ and ‘schedule announcement.’ The smaller cards are not busywork. They make starting honest.",
        ],
      },
      {
        heading: "Choose the card before pressing start",
        body: [
          "Move one card into progress and start the timer from there. Close the backlog. During the block, new work goes into an inbox or quick note; it does not get to replace the card because it arrived loudly.",
          "If the chosen task is blocked, stop the session rather than pretending. Write the blocker on the card, move it out of progress, and choose again.",
        ],
      },
      {
        heading: "Use breaks for your body, not your inbox",
        body: [
          "A five-minute break is barely long enough to stand up, drink water, and look away from the screen. Opening email turns it into a context switch with no clean ending.",
          "After three or four sessions, take a longer break. The exact rhythm matters less than keeping breaks distinct from low-grade work.",
        ],
      },
      {
        heading: "Reset the board before it lies to you",
        body: [
          "At the end of the day, clear In progress. Finish the card, return it to Today with a note, or split the remaining work. Do not let half-started cards pile up as wallpaper.",
          "On Friday, archive Done and look at what actually moved. That review should take a few minutes. If it takes longer, simplify the board again.",
        ],
      },
    ],
  },
  {
    slug: "how-to-calculate-focus-score",
    title: "How to calculate a weekly focus score without grading every minute",
    description:
      "A practical 0–100 focus score based on showing up, reaching a daily goal, finishing tasks, and following sessions through.",
    publishedAt: "2026-10-25",
    readMinutes: 8,
    category: "Focus Systems",
    keywords: ["focus score", "productivity score", "weekly focus review"],
    image: "/blog/weekly-focus-score.jpg",
    imageAlt:
      "A weekly paper tracker with check marks, daily columns, and a hand-drawn focus score dial.",
    relatedSlugs: ["analytics-that-help-you-focus", "pomodoro-task-board-setup"],
    sections: [
      {
        heading: "What the score is trying to answer",
        body: [
          "A useful focus score answers one plain question: did I do the work I intended to do this week? It should not reward sitting at a desk for the longest time. Long days are sometimes necessary, but they are a poor target.",
          "Tockli uses four parts that a person can picture and change: consistency, the daily session goal, cards finished, and follow-through. Together they make a score out of 100.",
        ],
      },
      {
        heading: "The four parts of the calculation",
        body: [
          "Consistency is worth 35 points. Divide the working days when you completed at least one session by the working days you planned. Rest days do not count against you, and one active rest day can cover one missed workday.",
          "The daily goal is worth 30 points. Score each planned workday separately, capped at the goal, then average the days. A huge Wednesday cannot erase an empty Monday and Tuesday.",
          "Cards finished are worth 20 points. Finishing roughly one card per planned workday earns the full component. Follow-through is worth the final 15 points: completed sessions divided by all completed and abandoned sessions.",
        ],
      },
      {
        heading: "A worked example",
        body: [
          "Suppose you planned five workdays. You completed sessions on four of them, reached your daily goal on three, finished four cards, and abandoned one session out of sixteen attempts.",
          "The exact number depends on how many sessions you completed on the two below-goal days, because the goal component gives partial credit. That is intentional. Missing a four-session target after completing three is different from never starting.",
          "Do the arithmetic once a week, not after every session. Tockli also waits for three active days before showing the in-app score, so an empty Monday does not feel like a final judgment on the week.",
        ],
      },
      {
        heading: "How to read a low component",
        body: [
          "Low consistency usually means the start of the day needs work. Make the first card smaller or choose it the night before. A low goal score can mean the goal is unrealistic, especially if consistency is healthy.",
          "Low completion points suggest cards are too large or ‘done’ is vague. Low follow-through usually calls for a shorter timer. None of those fixes require working longer.",
        ],
      },
      {
        heading: "Do not optimise the humanity out of it",
        body: [
          "A score is a prompt for a weekly review. It is not a grade, a medical measure, or proof that one week mattered more than another. Holidays, illness, care work, and emergencies do not fit neatly into a formula.",
          "Set your working days honestly, change the goal when life changes, and use the biggest lost component to choose one experiment for next week. Then close the analytics screen.",
        ],
      },
    ],
  },
  {
    slug: "focus-timer-vs-to-do-list",
    title: "Focus timer or to-do list? The useful answer is both",
    description:
      "To-do lists decide what matters. Focus timers protect time for it. Here is how to connect the two without duplicating your planning.",
    publishedAt: "2026-10-25",
    readMinutes: 6,
    category: "Practical Guides",
    keywords: ["focus timer with tasks", "focus timer to-do list", "task timer"],
    image: "/blog/focus-timer-and-task-list.jpg",
    imageAlt:
      "A long paper to-do list beside one selected task card and a pink-accented focus timer.",
    relatedSlugs: ["focus-timer-with-a-task-board", "pomodoro-task-board-setup"],
    sections: [
      {
        heading: "The list and the timer have different jobs",
        body: [
          "A to-do list stores commitments. It helps you remember, compare, and choose. A focus timer creates a temporary boundary around one choice. Asking either tool to do both jobs usually produces a strange result: an over-engineered timer or a list that never turns into action.",
          "Keep the list broad enough to see your options. Keep the timer narrow enough that there is no doubt what you are doing now.",
        ],
      },
      {
        heading: "Why separate apps create friction",
        body: [
          "The gap looks tiny: copy a task name into the timer, press start, then return to the list when you finish. In practice, that gap is where vague work survives. The timer records forty minutes, but the list still says ‘research’ and nobody knows what changed.",
          "Connecting a session to a card leaves a better trail. The card holds the intention, the timer holds the protected block, and the completion state records the result.",
        ],
      },
      {
        heading: "A simple daily loop",
        body: [
          "Choose up to three cards for Today. Pick one, move it into progress, and start a session. At the end, decide what happened before choosing another card.",
        ],
        bullets: [
          "Finished: move it to Done and write a note only if the result needs context.",
          "Moved forward: keep it in progress and write the exact restart point.",
          "Blocked: name the blocker and return the card to the right column.",
          "Wrong task: stop. Choosing again is cheaper than protecting the wrong work for another forty minutes.",
        ],
      },
      {
        heading: "What should stay off the timer",
        body: [
          "Not every task needs a formal session. Sending a two-line reply or renaming a file may take less time than starting the clock. Use timers for work that benefits from a boundary: writing, design, analysis, coding, study, or a batch of small admin tasks.",
          "You are building a useful record, not a complete surveillance log of your day. Leave the trivial bits alone.",
        ],
      },
      {
        heading: "When the system is working",
        body: [
          "The list gets shorter because cards finish, not because you reorganised them. The timer history names the work instead of showing anonymous blocks. And when you sit down tomorrow, the next card is visible.",
        ],
      },
    ],
  },
];

export function getBlogArticle(slug: string) {
  return blogArticles.find((article) => article.slug === slug);
}
