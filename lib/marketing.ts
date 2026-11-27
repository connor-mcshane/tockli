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
    "A simple Kanban board with a Pomodoro timer built in. Finish focus sessions, move cards to done, and see your productivity grow with Tockli.",
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
      "I have ADHD, and the hardest part of my day is starting. A timer helps, but only if it lives right next to the work.",
    publishedAt: "2026-07-24",
    updatedAt: "2026-11-25",
    readMinutes: 7,
    category: "Focus Systems",
    keywords: ["focus timer", "task board", "ADHD focus", "pomodoro", "task initiation"],
    image: "/blog/tockli-board-timer.jpg",
    imageAlt:
      "A Tockli board with To do, Doing and Done columns, and a focus timer running on the ‘Rewrite pricing headline’ card.",
    relatedSlugs: ["pomodoro-task-board-setup", "focus-timer-vs-to-do-list"],
    sections: [
      {
        heading: "Where I kept losing the morning",
        body: [
          "I have ADHD. I've always liked kanban boards. I used Trello and KanbanFlow for years, and seeing the work laid out in columns makes a messy week feel manageable. Starting the work is the hard part. I could look at a perfectly good board for half an hour and not move a single card.",
          "Pomodoro timers were the thing that finally got me going. Twenty-five minutes is short enough that my brain stops arguing. The problem was that the timer lived in one app and the board lived in another. Every switch was a chance to check Slack, reorder the backlog, or wander off entirely. By the time I'd started the clock, I'd often forgotten which card I meant to work on.",
          "Tockli is my attempt to close that gap. I'm not a front-end engineer, so I vibe coded it with AI tools, mainly as something to use myself. The timer starts from the card, so there's nothing in between to get distracted by.",
        ],
      },
      {
        heading: "A timer solves the second problem",
        body: [
          "A timer is great at protecting time. It's no help with deciding what the time is for, and for a lot of us that's where the day stalls. Russell Barkley, one of the best-known ADHD researchers, describes ADHD less as a problem of knowing what to do and more as a problem of doing what you know. The plan is usually fine. Turning it into action is the hard bit.",
          "Psychologists have a useful tool for this called an implementation intention: deciding in advance exactly what you'll do and when. Across dozens of studies, Peter Gollwitzer and Paschal Sheeran found that people who made these specific plans followed through noticeably more often than people who only set a goal. Picking a card and pressing start on that card is a tiny implementation intention. ‘Work on the website’ becomes ‘rewrite the pricing headline, now, for 25 minutes.’",
        ],
      },
      {
        heading: "Write cards you could finish in a session or two",
        body: [
          "A card called ‘website’ gives the timer nothing to hold on to. Name the next visible result instead: ‘rewrite the pricing headline’ or ‘compress the homepage images’. When the timer goes off, you should be able to tell whether you made progress.",
          "I don't estimate whole projects any more. I ask one question: is this card about one session, two, or too big to start? If it's too big I split it. Smaller cards are much easier to begin, which matters more to me than a tidy plan.",
        ],
      },
      {
        heading: "Leave yourself a note on where to restart",
        body: [
          "When a session ends, I either finish the card or write one line about where to pick it up. That line does more than it looks. Masicampo and Baumeister found that unfinished goals keep nagging at us, but making a concrete plan for them quietens that background noise. It makes it much easier for me to stop for the day.",
          "Keep it short. ‘Draft done, need to check the pricing table’ is plenty.",
        ],
      },
      {
        heading: "One card on the timer at a time",
        body: [
          "The board can hold a hundred cards. The timer should hold one. Sophie Leroy's research on ‘attention residue’ found that when people switch tasks, part of their attention stays stuck on the previous one, and they perform worse on the new task. If you hop between three cards inside one session, you pay that cost three times.",
          "If I finish early, I stop the session and pick the next card on purpose. Drifting straight into something else feels productive, but it usually means I lose the afternoon.",
        ],
      },
      {
        heading: "Sources",
        body: [
          "These are the studies I mentioned, if you want to read more.",
        ],
        bullets: [
          "Barkley, R. A. (2015). Attention-Deficit Hyperactivity Disorder: A Handbook for Diagnosis and Treatment (4th ed.). Guilford Press.",
          "Gollwitzer, P. M., & Sheeran, P. (2006). Implementation intentions and goal achievement: A meta-analysis of effects and processes. Advances in Experimental Social Psychology, 38.",
          "Masicampo, E. J., & Baumeister, R. F. (2011). Consider it done! Plan making can eliminate the cognitive effects of unfulfilled goals. Journal of Personality and Social Psychology, 101(4).",
          "Leroy, S. (2009). Why is it so hard to do my work? The challenge of attention residue when switching between work tasks. Organizational Behavior and Human Decision Processes, 109(2).",
        ],
      },
    ],
  },
  {
    slug: "lightweight-sharing-for-small-teams",
    title: "Sharing a board with someone else can make starting easier",
    description:
      "A shared board isn't just for managing a team. Knowing someone else can see your work is often enough to get you moving.",
    publishedAt: "2026-07-24",
    updatedAt: "2026-11-25",
    readMinutes: 5,
    category: "Team Focus",
    keywords: ["shared task board", "body doubling", "accountability partner", "small team kanban"],
    image: "/blog/shared-focus-board.jpg",
    imageAlt:
      "Two people moving paper cards on a shared board beside a focus timer.",
    relatedSlugs: ["focus-timer-with-a-task-board", "pomodoro-task-board-setup"],
    sections: [
      {
        heading: "I work better when someone's watching (a little)",
        body: [
          "There's a trick a lot of people with ADHD swear by called body doubling: working with someone else nearby, even if they're doing something completely different. I noticed it working for me long before I knew it had a name.",
          "Body doubling hasn't been studied much yet. Most of the support comes from people's own experience. A related idea has some research behind it, though. Gail Matthews at Dominican University ran a study with 149 people working on personal goals. More than 70% of the group who sent weekly progress updates to a friend said they'd achieved their goal or were more than halfway there, well ahead of the groups who kept their goals to themselves. It was a small study that wasn't published in a journal, but it matches my experience.",
        ],
      },
      {
        heading: "What a shared board needs to show",
        body: [
          "For two or three people, a board needs to answer three questions. What's moving? Who's doing the next step? What's stuck? If it answers those, you can skip most status meetings.",
          "It goes wrong when the board tries to hold every conversation too. It gets heavy, people stop updating it, and everyone drifts back to asking in chat. Keep the board for the state of the work and have the long discussions somewhere else.",
        ],
      },
      {
        heading: "Give every card one owner",
        body: [
          "A card with two owners tends to have nobody moving it. In a classic 1968 study, Darley and Latané showed that the more people who could respond to a problem, the less likely any one of them was to act. Put one name on each card, even if several people help.",
          "In Tockli, give editor access to people who change the work and viewer access to people who just need to see it.",
        ],
      },
      {
        heading: "Share what moved, not how long you sat there",
        body: [
          "Your focus sessions are yours. A teammate needs to know that the card moved, not how many minutes you spent on it. One line on the card, like ‘draft ready, legal wording still needs checking’, tells the next person what they need to know.",
          "That's also what makes sharing comfortable. I find it motivating when people can see my progress, but I wouldn't want anyone counting my minutes.",
        ],
      },
      {
        heading: "Sources",
        bullets: [
          "Matthews, G. (2007). The impact of commitment, accountability, and written goals on goal achievement. Paper presented at the 87th Convention of the Western Psychological Association, Vancouver.",
          "Darley, J. M., & Latané, B. (1968). Bystander intervention in emergencies: Diffusion of responsibility. Journal of Personality and Social Psychology, 8(4).",
        ],
        body: [],
      },
    ],
  },
  {
    slug: "analytics-that-help-you-focus",
    title: "Focus stats should tell you what to change next week",
    description:
      "Counting hours made me feel worse and didn't tell me what to change. These are the four numbers I look at each week instead.",
    publishedAt: "2026-07-24",
    updatedAt: "2026-11-25",
    readMinutes: 6,
    category: "Analytics",
    keywords: ["focus tracking", "weekly review", "productivity stats", "ADHD productivity"],
    image: "/blog/weekly-review-numbers.jpg",
    imageAlt:
      "A weekly review showing sessions per day, two rest days, and four numbers: days showed up, days hit goal, cards finished and sessions abandoned.",
    relatedSlugs: ["how-to-calculate-focus-score", "focus-timer-with-a-task-board"],
    sections: [
      {
        heading: "Why I stopped counting hours",
        body: [
          "My old timer app gave me a big total at the end of each week. Some weeks it was huge and I'd still finished nothing important. Other weeks it was small because I'd been ill, and the number made me feel like I'd failed. Neither told me what to do differently.",
          "With ADHD, I'm already quick to read a bad day as proof that something's wrong with me. I needed numbers that pointed to a fix, not a judgement.",
        ],
      },
      {
        heading: "Progress is what actually keeps people going",
        body: [
          "Teresa Amabile and Steven Kramer collected nearly 12,000 daily diary entries from 238 people working on creative projects. The single biggest thing that lifted people's mood and motivation on a given day was making progress on meaningful work, even a small step. They called it the progress principle.",
          "That's why I care more about finished cards than minutes logged. A finished card is progress you can see. Minutes are effort, and effort without results is exactly the feeling that makes me want to give up.",
        ],
      },
      {
        heading: "The four numbers I look at",
        body: [
          "These fit on one screen, and each one points to a different fix.",
        ],
        bullets: [
          "Days I showed up. If this is low, the first session of the day is too hard to start. Make the first card smaller or pick it the night before.",
          "Days I hit my session goal. If I'm showing up but missing the goal, the goal is probably too ambitious. Lower it for a week and see what happens.",
          "Cards finished. Lots of sessions but few finished cards usually means my cards are too big.",
          "Sessions abandoned. If I keep quitting halfway, I shorten the timer. That fixes it far more often than trying harder.",
        ],
      },
      {
        heading: "Look for patterns across a few weeks",
        body: [
          "One bad Tuesday is just a bad Tuesday. I wait until something repeats for two or three weeks before I change anything, and then I change one thing at a time so I can tell whether it helped.",
          "I do the review on Sunday evening or Monday morning. Dai, Milkman and Riis found that people are more likely to start new habits at ‘fresh start’ moments like the beginning of a week or month.",
        ],
      },
      {
        heading: "Sources",
        body: [],
        bullets: [
          "Amabile, T., & Kramer, S. (2011). The Progress Principle: Using Small Wins to Ignite Joy, Engagement, and Creativity at Work. Harvard Business Review Press.",
          "Dai, H., Milkman, K. L., & Riis, J. (2014). The fresh start effect: Temporal landmarks motivate aspirational behavior. Management Science, 60(10).",
        ],
      },
    ],
  },
  {
    slug: "pomodoro-task-board-setup",
    title: "A Pomodoro task board setup that doesn't become another job",
    description:
      "The simple board-and-timer setup I use to get started on work, without spending the morning reorganising my tasks.",
    publishedAt: "2026-10-25",
    updatedAt: "2026-11-25",
    readMinutes: 7,
    category: "Practical Guides",
    keywords: ["pomodoro task board", "kanban pomodoro", "ADHD kanban", "focus task manager"],
    image: "/blog/pomodoro-task-board.jpg",
    imageAlt:
      "A simple three-column paper task board and a compact focus timer on a sunlit desk.",
    relatedSlugs: ["focus-timer-with-a-task-board", "focus-timer-vs-to-do-list"],
    sections: [
      {
        heading: "Fiddling with the board is a trap",
        body: [
          "I used to spend my best hour of the day setting up my board. New columns, colour-coded labels, a perfect priority order. It felt like work, and it stopped me from doing any actual work. If you have ADHD you might recognise this one: organising is so much more appealing than starting.",
          "This is the setup I've ended up with after a lot of over-engineering. It's deliberately boring.",
        ],
      },
      {
        heading: "Four columns",
        body: [
          "Backlog, Today, In progress, Done. That's it. Extra columns look precise, but during a focus session the only question that matters is whether you're doing this now or not.",
          "Keep Today to about three cards. The backlog can be messy, because it's somewhere to put things, not a promise to do them.",
          "Kanban teams have a rule for this called a work-in-progress limit. Little's Law, from queueing theory, shows why it works: with the same throughput, the more you have on the go at once, the longer each item takes to finish. On a personal board, that means one card in progress and two or three in Today.",
        ],
      },
      {
        heading: "Choose the timer length to match the card",
        body: [
          "Francesco Cirillo came up with the Pomodoro Technique as a student in the late 1980s, using a tomato-shaped kitchen timer. That's where the 25 minutes comes from, but you don't have to stick to it.",
          "I use 25 minutes for anything I'm dreading, because it's short enough to say yes to. Writing or coding gets 45 or 50 minutes once I'm warmed up. If a card can't move in one or two sessions, I split it: ‘prepare launch’ becomes ‘draft the launch email’, ‘test the sign-up flow’ and ‘schedule the post’.",
        ],
      },
      {
        heading: "Why I aim for three sessions a day",
        body: [
          "Three sessions a day is the target that works for me. It doesn't sound like much, but if I manage it most days I get through far more by the end of the week than I used to.",
          "The first session is usually the hardest. By the second or third, I'm often in a flow state, where the work has my full attention and time goes quickly. Mihaly Csikszentmihalyi, the psychologist who named flow, found it tends to happen when a task has a clear goal, gives you quick feedback and is hard enough to stretch you without being overwhelming. A single card with a timer running covers the first two.",
          "So I treat the first session as a warm-up and don't expect much from it. Its job is to get me to the second one.",
        ],
      },
      {
        heading: "Pick the card before you press start",
        body: [
          "Move one card into In progress and start the timer from that card. Close the backlog. If something new comes up during the session, jot it down and come back to it later. It doesn't get to take over just because it arrived loudly.",
          "If the card turns out to be blocked, stop the session. Write down what's blocking it, move it back, and pick another. There's no point finishing a session on the wrong card just to keep the timer going.",
        ],
      },
      {
        heading: "Keep breaks for actual breaks",
        body: [
          "Five minutes is long enough to stand up, get some water and look out of a window. If you check email instead, you've just started another task with no clear end.",
          "Taking breaks at fixed times may also help. A 2023 study by Biwer and colleagues compared students who took a short break every 24 minutes with students who decided for themselves when to stop. The fixed-break group was in a better mood and finished the same work in less time.",
        ],
      },
      {
        heading: "Five minutes of tidying at the end of the day",
        body: [
          "Before you finish, empty In progress. Each card either goes to Done, goes back to Today with a note about where to restart, or gets split. Half-started cards pile up fast, and a cluttered board is much harder to start from tomorrow.",
          "On Friday, archive the Done column and take a minute to look at what you finished. If the review takes longer than a few minutes, simplify the board.",
        ],
      },
      {
        heading: "Sources",
        body: [],
        bullets: [
          "Csikszentmihalyi, M. (1990). Flow: The Psychology of Optimal Experience. Harper & Row.",
          "Cirillo, F. (2018). The Pomodoro Technique: The Acclaimed Time-Management System That Has Transformed How We Work. Currency.",
          "Little, J. D. C. (1961). A proof for the queuing formula L = λW. Operations Research, 9(3).",
          "Biwer, F., Wiradhany, W., oude Egbrink, M. G. A., & de Bruin, A. B. H. (2023). Understanding effort regulation: Comparing ‘Pomodoro’ breaks and self-regulated breaks. British Journal of Educational Psychology, 93(S2).",
        ],
      },
    ],
  },
  {
    slug: "how-to-calculate-focus-score",
    title: "How Tockli's weekly focus score works, and why rest days don't count against you",
    description:
      "A 0–100 score built around showing up, hitting a realistic daily goal, finishing cards and finishing sessions, with rest days that never count against you.",
    publishedAt: "2026-10-25",
    updatedAt: "2026-11-25",
    readMinutes: 8,
    category: "Focus Systems",
    keywords: ["focus score", "productivity streak", "weekly focus review", "ADHD streaks"],
    image: "/blog/focus-score-breakdown.jpg",
    imageAlt:
      "Bar chart of the Tockli focus score: showing up 35 points, daily goal 30, cards finished 20, follow-through 15, totalling 100.",
    relatedSlugs: ["analytics-that-help-you-focus", "pomodoro-task-board-setup"],
    sections: [
      {
        heading: "Why I didn't want a normal streak",
        body: [
          "Streaks motivate me a lot. The trouble is what happens when I miss a day. The counter goes back to zero, and I usually stop opening the app soon afterwards.",
          "Researchers have seen this too. Across seven studies, Silverman and Barasch found that people stayed more engaged with an activity while their streak was intact, and less once it broke. The drop was bigger when people blamed themselves, and smaller when they could repair the streak.",
          "So I wanted Tockli's score to keep the motivation of a streak without a single missed day wiping it out.",
        ],
      },
      {
        heading: "Missing a day doesn't undo your progress",
        body: [
          "There's good evidence that a missed day doesn't matter much. In a well-known study, Phillippa Lally and colleagues at UCL tracked people building a new daily habit. On average it took about 66 days for the behaviour to become automatic, and the range ran from 18 days to an estimated 254. Missing a single day didn't significantly affect how the habit formed. People who missed a lot of days did struggle, so consistency over the week still matters.",
          "So the score works on a whole week, not a chain of days. You choose which days you plan to work. Rest days don't count against you, and working on a rest day can make up for a missed workday.",
        ],
      },
      {
        heading: "The four parts of the score",
        body: [
          "Showing up is worth 35 points: the number of planned workdays where you completed at least one session, divided by the number of workdays you planned. It's the biggest part on purpose. On a hard day, one session still counts.",
          "Your daily session goal is worth 30 points. Each planned workday is scored on its own and capped at your goal, then the days are averaged. A huge Wednesday can't make up for an empty Monday and Tuesday, which stops the score from rewarding all-nighters.",
          "Cards finished are worth 20 points. Finishing about one card per planned workday earns all of them. Follow-through is worth the last 15: completed sessions divided by all the sessions you started, including the ones you abandoned.",
        ],
      },
      {
        heading: "A worked example",
        body: [
          "Say you planned five workdays. You completed sessions on four of them, hit your goal on three, finished four cards, and abandoned one session out of sixteen.",
          "That's 28 of 35 for showing up (4 of 5 days) and about 14 of 15 for follow-through (15 of 16 sessions). Four cards across five planned days gives 16 of 20. Your goal points depend on how close you got on the two days you fell short, because the score gives partial credit. Three sessions out of a goal of four is very different from none.",
          "Tockli waits until you've had three active days before showing the score, so a slow Monday doesn't look like a verdict on the whole week.",
        ],
      },
      {
        heading: "What to do with a low score",
        body: [
          "Look at whichever part is lowest. If you're not showing up, make the first card of the day smaller or choose it the night before. If you're showing up but missing your goal, the goal is too high, so lower it. Few finished cards usually means they're too big. Lots of abandoned sessions usually means the timer's too long.",
          "None of those fixes involve working longer hours. Pick one, try it for a week, and look again.",
        ],
      },
      {
        heading: "It's a prompt, not a grade",
        body: [
          "The score is there to start a weekly review. It doesn't account for illness, caring for someone, or a week when other things had to come first. Be honest about which days you plan to work, change your goal when your circumstances change, and use the score to plan next week.",
        ],
      },
      {
        heading: "Sources",
        body: [],
        bullets: [
          "Silverman, J., & Barasch, A. (2023). On or off track: How (broken) streaks affect consumer decisions. Journal of Consumer Research, 49(6), 1095–1117.",
          "Lally, P., van Jaarsveld, C. H. M., Potts, H. W. W., & Wardle, J. (2010). How are habits formed: Modelling habit formation in the real world. European Journal of Social Psychology, 40(6).",
        ],
      },
    ],
  },
  {
    slug: "focus-timer-vs-to-do-list",
    title: "Focus timer or to-do list? Why I stopped using them separately",
    description:
      "Switching between a to-do app and a timer app cost me more focus than I realised, so I put them in one place.",
    publishedAt: "2026-10-25",
    updatedAt: "2026-11-25",
    readMinutes: 6,
    category: "Practical Guides",
    keywords: ["focus timer with tasks", "to-do list with timer", "task timer", "ADHD app switching"],
    image: "/blog/app-switching.jpg",
    imageAlt:
      "Diagram comparing a to-do app and a timer app with distractions between them, against a single card with the timer running on it.",
    relatedSlugs: ["focus-timer-with-a-task-board", "pomodoro-task-board-setup"],
    sections: [
      {
        heading: "Two apps, two jobs",
        body: [
          "A to-do list is good at holding everything you've committed to, so you can compare options and choose. A focus timer is good at drawing a box around one of those choices for 25 minutes. They're different jobs, and for years I used a different app for each.",
          "On paper, that's fine. In practice, the bit between the two apps is exactly where I lose my focus.",
        ],
      },
      {
        heading: "The cost of switching",
        body: [
          "Moving from the list to the timer looks like nothing: copy the task name, switch apps, press start. But every switch is a chance to see a notification and end up somewhere else.",
          "Gloria Mark at UC Irvine has spent about two decades measuring how people's attention moves on screens. In her book Attention Span, she reports that people now spend an average of about 47 seconds on one screen before switching. Her earliest studies, about 20 years ago, put the figure at around two and a half minutes. In a 2008 study, she found that people who were interrupted got their work done faster to make up for it, but felt more stressed and under more time pressure.",
          "For someone with ADHD, that's a big deal. If I get distracted on the way from the list to the timer, I can lose the whole morning.",
        ],
      },
      {
        heading: "When they're joined, you can see what you did",
        body: [
          "With separate apps, my timer history said I'd done 40 minutes of something and my list still said ‘research’. Neither could tell me what had actually happened.",
          "When the session starts from a card, the record makes sense. The card holds what you meant to do, the timer holds the time you protected for it, and moving the card to Done records the result.",
        ],
      },
      {
        heading: "A simple daily routine",
        body: [
          "Pick up to three cards for today. Choose one, move it to In progress and start a session from it. When the timer ends, decide what happened before you pick the next card.",
        ],
        bullets: [
          "Finished: move it to Done.",
          "Made progress: leave it in progress and write down exactly where to restart.",
          "Blocked: write down what's blocking it and move it back.",
          "Wrong task: stop. Picking again costs less than spending another 40 minutes on the wrong thing.",
        ],
      },
      {
        heading: "Not everything needs a timer",
        body: [
          "A two-line reply or renaming a file takes less time than starting a session. I use the timer for anything I tend to put off: writing, design, analysis, coding, studying, or a batch of small admin tasks I've been dodging. Doing all the boring tasks in one 25-minute session works well for me.",
        ],
      },
      {
        heading: "Sources",
        body: [],
        bullets: [
          "Mark, G. (2023). Attention Span: A Groundbreaking Way to Restore Balance, Happiness and Productivity. Hanover Square Press.",
          "Mark, G., Gudith, D., & Klocke, U. (2008). The cost of interrupted work: More speed and stress. Proceedings of CHI 2008.",
        ],
      },
    ],
  },
];

export function getBlogArticle(slug: string) {
  return blogArticles.find((article) => article.slug === slug);
}
