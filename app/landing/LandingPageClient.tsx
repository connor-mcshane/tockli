"use client";

import {
  BarChart3,
  Check,
  CheckCircle2,
  Clock3,
  FolderKanban,
  Play,
  RotateCcw,
  Sparkles,
  TimerReset,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import MarketingFooter from "@/app/MarketingFooter";
import MarketingHeader from "@/app/MarketingHeader";
import { trackEvent } from "@/lib/analytics";

type DemoPhase = "choose" | "focus" | "banked";
type DemoStatus = "rest" | "missed" | "showed_up" | "goal";

type DemoCell = {
  id: string;
  label: string;
  sessions: number;
  status: DemoStatus;
  taskFinished: boolean;
};

const focusLoop = [
  {
    id: "choose" as const,
    eyebrow: "Kanban board",
    title: "Keep the work where you can see it.",
    description:
      "Use a simple board for what is waiting, what is happening, and what is done.",
    icon: FolderKanban,
  },
  {
    id: "focus" as const,
    eyebrow: "Pomodoro timer",
    title: "Start a session from any card.",
    description:
      "The task stays in front of you while the clock keeps everything else out.",
    icon: Clock3,
  },
  {
    id: "banked" as const,
    eyebrow: "Momentum",
    title: "See the finished work add up.",
    description:
      "Sessions, completed cards, streaks, and trends are ready when you want them.",
    icon: BarChart3,
  },
];

const scoreComponents = [
  { id: "consistency", label: "Showing up", weight: 35 },
  { id: "goal", label: "Daily goal", weight: 30 },
  { id: "completion", label: "Cards finished", weight: 20 },
  { id: "follow-through", label: "Follow-through", weight: 15 },
];

function createDemoCells() {
  const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  return Array.from({ length: 84 }, (_, index): DemoCell => {
    const week = Math.floor(index / 7) + 1;
    const dayIndex = index % 7;
    const isRestDay = dayIndex > 4;
    const status: DemoStatus = isRestDay
      ? "rest"
      : (week + dayIndex) % 7 === 0
        ? "missed"
        : (week * 2 + dayIndex) % 3 === 0
          ? "goal"
          : "showed_up";

    return {
      id: `week-${week}-day-${dayIndex}`,
      label: `Week ${week}, ${weekdays[dayIndex]}`,
      sessions: status === "goal" ? 4 : status === "showed_up" ? 2 : 0,
      status,
      taskFinished: status === "goal" && (week + dayIndex) % 2 === 0,
    };
  });
}

const baseDemoCells = createDemoCells();

const demoColumns = [
  {
    id: "backlog",
    title: "Backlog",
    cards: ["Review competitor notes", "Draft launch email"],
  },
  {
    id: "today",
    title: "Today",
    cards: ["Refine the landing-page story", "Tidy the signup copy"],
  },
  {
    id: "done",
    title: "Done",
    cards: ["Map the homepage flow"],
  },
];

function formatDemoTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function MiniKanbanPlayground({
  phase,
  onAdvance,
  onSelectCard,
}: {
  phase: DemoPhase;
  onAdvance: () => void;
  onSelectCard: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);

  useEffect(() => {
    if (phase !== "focus") return;

    const timer = window.setInterval(() => {
      setSecondsLeft((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [phase]);

  function runDemoAction() {
    if (phase === "choose") setSecondsLeft(25 * 60);
    if (phase === "focus") setSecondsLeft(0);
    if (phase === "banked") setSecondsLeft(25 * 60);
    onAdvance();
  }

  const action =
    phase === "choose"
      ? { label: "Start focus timer", icon: Play }
      : phase === "focus"
        ? { label: "Finish this session", icon: CheckCircle2 }
        : { label: "Try it again", icon: RotateCcw };
  const ActionIcon = action.icon;

  return (
    <div className="relative mx-auto w-full max-w-3xl">
      <div className="absolute -inset-8 -z-10 rounded-[42px] bg-[radial-gradient(circle_at_top_left,rgba(255,0,94,0.17),transparent_48%),radial-gradient(circle_at_bottom_right,rgba(47,111,237,0.13),transparent_46%)] blur-2xl" />
      <div className="overflow-hidden rounded-[28px] border border-[#dededa] bg-white shadow-[0_30px_90px_rgba(26,28,27,0.16)]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#ececea] px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#fff0f5] text-[#ff005e]">
              <FolderKanban size={20} aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-[#77746e]">Website launch</p>
              <p className="text-lg font-bold text-[#171918]">Tockli board</p>
            </div>
          </div>
          <span className="rounded-full border border-[#dcdcd8] bg-[#f8f8f6] px-3 py-1.5 text-sm font-semibold text-[#55534f]">
            4 cards this week
          </span>
        </div>

        <div className="overflow-x-auto bg-[#f8f8f6] p-4 sm:p-5">
          <div className="grid min-w-[620px] grid-cols-3 gap-3" aria-label="Interactive mini Kanban board">
            {demoColumns.map((column) => {
              const cards = column.cards.filter(
                (card) => !(phase === "banked" && column.id === "today" && card === "Refine the landing-page story"),
              );
              if (phase === "banked" && column.id === "done") {
                cards.push("Refine the landing-page story");
              }

              return (
                <div key={column.id} className="rounded-2xl border border-[#e3e3df] bg-[#eeeeeb] p-3">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-sm font-bold text-[#454743]">{column.title}</p>
                    <span className="rounded-full bg-white px-2 py-0.5 text-sm font-semibold text-[#77746e]">
                      {cards.length}
                    </span>
                  </div>
                  <div className="mt-3 space-y-2.5">
                    {cards.map((card) => {
                      const isDemoCard = card === "Refine the landing-page story";
                      const isSelected = isDemoCard && phase !== "banked";
                      const isFinished = isDemoCard && phase === "banked";

                      return (
                        <button
                          key={`${column.id}-${card}`}
                          aria-pressed={isSelected || isFinished}
                          className={`w-full rounded-xl border bg-white p-3 text-left shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[#ff005e] focus:ring-offset-2 ${
                            isSelected
                              ? "border-[#ff005e] shadow-[0_8px_22px_rgba(255,0,94,0.12)]"
                              : isFinished
                                ? "border-[#b6ddcd] bg-[#f1faf6]"
                                : "border-[#dededa] hover:border-[#ff9ebe]"
                          }`}
                          type="button"
                          onClick={isDemoCard ? onSelectCard : undefined}
                        >
                          <span className="block text-sm font-semibold leading-5 text-[#292b28]">
                            {card}
                          </span>
                          {isDemoCard ? (
                            <span className={`mt-3 flex items-center gap-1.5 text-sm font-bold ${isFinished ? "text-[#12805c]" : "text-[#d90050]"}`}>
                              {isFinished ? <CheckCircle2 size={15} aria-hidden="true" /> : <Clock3 size={15} aria-hidden="true" />}
                              {isFinished ? "Done · 25 min" : phase === "focus" ? "Timer running" : "25 min focus"}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid items-center gap-4 border-t border-[#e4e4e0] bg-white p-5 sm:grid-cols-[1fr_auto] sm:p-6">
          <div className="flex min-w-0 items-center gap-4">
            <div className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl ${phase === "focus" ? "bg-[#171918] text-white" : phase === "banked" ? "bg-[#e9f7f1] text-[#12805c]" : "bg-[#fff0f5] text-[#d90050]"}`}>
              {phase === "banked" ? <CheckCircle2 size={27} aria-hidden="true" /> : <Clock3 size={27} aria-hidden="true" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#77746e]">
                {phase === "banked" ? "Session saved" : "Refine the landing-page story"}
              </p>
              <p className="mt-0.5 text-3xl font-bold tabular-nums tracking-[-0.04em] text-[#171918]">
                {phase === "banked" ? "+25 min" : formatDemoTime(secondsLeft)}
              </p>
            </div>
          </div>
          <button
            className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-[#ff005e] focus:ring-offset-2 ${
              phase === "banked"
                ? "bg-[#f0f0ee] text-[#393b38] hover:bg-[#e8e8e6]"
                : "bg-[#ff005e] text-white shadow-[0_12px_30px_rgba(255,0,94,0.24)] hover:bg-[#e00054]"
            }`}
            type="button"
            onClick={runDemoAction}
          >
            <ActionIcon size={17} aria-hidden="true" />
            {action.label}
          </button>
        </div>
      </div>
    </div>
  );
}

function statusLabel(status: DemoStatus) {
  if (status === "goal") return "Daily goal reached";
  if (status === "showed_up") return "Showed up";
  if (status === "missed") return "Planned day missed";
  return "Rest day";
}

function demoCellClasses(status: DemoStatus, active: boolean, selected: boolean) {
  const base =
    "relative h-[18px] w-[18px] rounded-[5px] border transition duration-300 focus:outline-none focus:ring-2 focus:ring-[#ff005e] focus:ring-offset-2 sm:h-5 sm:w-5";
  const state =
    status === "goal"
      ? "border-[#ff005e] bg-[#ff005e] shadow-[0_5px_12px_rgba(255,0,94,0.22)]"
      : status === "showed_up"
        ? "border-[#ff9ebe] bg-[#ffc5d8]"
        : status === "missed"
          ? "border-[#d8d7d3] bg-white"
          : "border-transparent bg-[#ececea]";

  return `${base} ${state} ${active ? "momentum-cell-pop" : ""} ${
    selected ? "ring-2 ring-[#1a1c1b] ring-offset-2" : ""
  }`;
}

function MomentumPlayground({
  phase,
}: {
  phase: DemoPhase;
}) {
  const [selectedCellId, setSelectedCellId] = useState(baseDemoCells.at(-1)?.id ?? "");
  const demoCells = useMemo(() => {
    const lastIndex = baseDemoCells.length - 1;

    return baseDemoCells.map((cell, index) => {
      if (index !== lastIndex) return cell;

      if (phase === "banked") {
        return {
          ...cell,
          label: "Today",
          sessions: 4,
          status: "goal" as const,
          taskFinished: true,
        };
      }

      if (phase === "focus") {
        return {
          ...cell,
          label: "Today",
          sessions: 3,
          status: "showed_up" as const,
          taskFinished: false,
        };
      }

      return {
        ...cell,
        label: "Today",
        sessions: 0,
        status: "missed" as const,
        taskFinished: false,
      };
    });
  }, [phase]);
  const selectedCell =
    demoCells.find((cell) => cell.id === selectedCellId) ?? demoCells.at(-1)!;
  const score = phase === "banked" ? 82 : phase === "focus" ? 76 : 72;
  const streak = phase === "banked" ? 6 : phase === "focus" ? 5 : 4;

  return (
    <div className="relative mx-auto w-full max-w-2xl">
      <div className="absolute -inset-8 -z-10 rounded-[40px] bg-[radial-gradient(circle_at_top_left,rgba(255,0,94,0.16),transparent_52%),radial-gradient(circle_at_bottom_right,rgba(47,111,237,0.10),transparent_45%)] blur-2xl" />
      <div className="overflow-hidden rounded-[28px] border border-[#dededa] bg-white shadow-[0_30px_90px_rgba(26,28,27,0.16)]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#ececea] px-5 py-5 sm:px-7">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.12em] text-[#d90050]">
              Your momentum
            </p>
            <p className="mt-1 text-xl font-semibold text-[#171918]">
              A week you can see building
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-[#f7f7f5] px-3 py-2 text-right">
              <p className="text-sm font-semibold text-[#77746e]">Streak</p>
              <p className="text-lg font-bold text-[#171918]">{streak} days</p>
            </div>
            <div className="rounded-xl bg-[#171918] px-3 py-2 text-right text-white">
              <p className="text-sm font-semibold text-white/65">Score</p>
              <p className="text-lg font-bold">{score}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_190px]">
          <div className="min-w-0 p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-[#252724]">Last 12 weeks</p>
                <p className="mt-1 text-sm text-[#77746e]">
                  Select a day to see what moved.
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#77746e]">
                <span className="h-3 w-3 rounded-[4px] bg-[#ffc5d8]" />
                Showed up
                <span className="ml-1 h-3 w-3 rounded-[4px] bg-[#ff005e]" />
                Hit goal
              </div>
            </div>

            <div className="mt-5 overflow-x-auto pb-3">
              <div
                aria-label="Interactive twelve-week momentum graph"
                className="grid w-max grid-flow-col grid-rows-7 gap-1.5"
                role="grid"
              >
                {demoCells.map((cell, index) => {
                  const active = index === demoCells.length - 1 && phase !== "choose";
                  const selected = cell.id === selectedCell.id;
                  return (
                    <button
                      key={cell.id}
                      aria-label={`${cell.label}: ${statusLabel(cell.status)}, ${cell.sessions} sessions${
                        cell.taskFinished ? ", card finished" : ""
                      }`}
                      aria-selected={selected}
                      className={demoCellClasses(cell.status, active, selected)}
                      role="gridcell"
                      type="button"
                      onClick={() => setSelectedCellId(cell.id)}
                    >
                      {cell.taskFinished ? (
                        <span className="absolute right-0.5 top-0.5 h-1 w-1 rounded-full bg-white" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-2 rounded-2xl border border-[#e8e8e6] bg-[#f9f9f7] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[#77746e]">{selectedCell.label}</p>
                  <p className="mt-1 text-base font-bold text-[#252724]">
                    {statusLabel(selectedCell.status)}
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-[#d90050]">
                  {selectedCell.sessions} sessions
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-[#62605b]">
                {selectedCell.taskFinished
                  ? "You followed the session through and moved a real card to done."
                  : selectedCell.status === "rest"
                    ? "Rest days stay visible without counting against your rhythm."
                    : selectedCell.status === "missed"
                      ? "A quiet day is information, not a verdict. Start with one block."
                      : "You showed up. One more protected block would reach the daily goal."}
              </p>
            </div>
          </div>

          <div className="border-t border-[#ececea] bg-[#fbfbf9] p-5 lg:border-l lg:border-t-0">
            <p className="text-sm font-bold uppercase tracking-[0.1em] text-[#77746e]">
              This week
            </p>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-[#e3e3df] bg-white p-4">
                <p className="text-sm font-semibold text-[#77746e]">Focus sessions</p>
                <p className="mt-1 text-2xl font-bold text-[#252724]">
                  {phase === "banked" ? 13 : phase === "focus" ? 12 : 11}
                </p>
              </div>
              <div className="rounded-2xl border border-[#e3e3df] bg-white p-4">
                <p className="text-sm font-semibold text-[#77746e]">Cards finished</p>
                <p className="mt-1 text-2xl font-bold text-[#252724]">
                  {phase === "banked" ? 4 : 3}
                </p>
              </div>
            </div>

            <div className="mt-5 border-t border-[#e8e8e6] pt-5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-[#77746e]">Today</span>
                <span className="font-bold text-[#252724]">
                  {phase === "banked" ? "4/4" : phase === "focus" ? "3/4" : "0/4"}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e8e8e6]">
                <div
                  className="h-full rounded-full bg-[#ff005e] transition-[width] duration-500"
                  style={{
                    width:
                      phase === "banked" ? "100%" : phase === "focus" ? "75%" : "4%",
                  }}
                />
              </div>
              <p className="mt-4 text-sm leading-6 text-[#62605b]">
                {phase === "banked"
                  ? "That finished card is already part of the week."
                  : phase === "focus"
                    ? "The running timer has put today on the board."
                    : "Finish a session from the board and today lights up here."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPageClient() {
  const [phase, setPhase] = useState<DemoPhase>("choose");

  function trackCta(cta: string, destination: string) {
    trackEvent("cta_clicked", {
      cta,
      destination,
      surface: "landing",
    });
  }

  function updatePhase(nextPhase: DemoPhase, source: string) {
    setPhase(nextPhase);
    trackEvent("landing_product_demo_used", {
      phase: nextPhase,
      source,
      surface: "landing",
    });
  }

  function advanceDemo() {
    const nextPhase = phase === "choose" ? "focus" : phase === "focus" ? "banked" : "choose";
    updatePhase(nextPhase, "kanban_timer");
  }

  const score = phase === "banked" ? 82 : phase === "focus" ? 76 : 72;

  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f7f5] text-[#1a1c1b]">
      <MarketingHeader />

      <section className="relative border-b border-[#e8e8e6] px-4 py-14 md:px-8 md:py-24">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute left-[-8rem] top-20 h-80 w-80 rounded-full bg-[#ffd6e4]/45 blur-3xl" />
          <div className="absolute right-[-5rem] top-[-4rem] h-96 w-96 rounded-full bg-[#e6edff]/55 blur-3xl" />
        </div>
        <div className="relative mx-auto grid max-w-[1440px] items-center gap-14 xl:grid-cols-[0.78fr_1.22fr] xl:gap-16">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#ffd0e1] bg-white/75 px-3 py-2 text-sm font-bold text-[#d90050] shadow-sm backdrop-blur">
              <Sparkles size={15} aria-hidden="true" />
              Kanban + Pomodoro
            </p>
            <h1 className="mt-6 text-5xl font-semibold leading-[0.96] tracking-[-0.05em] text-[#111312] sm:text-6xl lg:text-7xl">
              Get on a roll.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#4f4d49] sm:text-xl">
              Start a focus timer straight from your Kanban board. Tockli keeps
              track of your sessions and finished cards, so you can see your
              productivity grow.
            </p>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-[#62605b]">
              <span className="flex items-center gap-2">
                <Check className="text-[#12805c]" size={17} aria-hidden="true" />
                Kanban and timer together
              </span>
              <span className="flex items-center gap-2">
                <Check className="text-[#12805c]" size={17} aria-hidden="true" />
                Free to start
              </span>
            </div>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                className="flex min-h-12 items-center rounded-xl bg-[#ff005e] px-6 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(255,0,94,0.24)] transition hover:-translate-y-0.5 hover:bg-[#e00054]"
                href="/signup"
                onClick={() => trackCta("hero_signup", "/signup")}
              >
                Give it a try
              </Link>
              <a
                className="flex min-h-12 items-center rounded-xl border border-[#d7d7d2] bg-white/80 px-6 py-3 text-sm font-bold text-[#393b38] transition hover:border-[#ff005e] hover:text-[#d90050]"
                href="#try-it"
                onClick={() => trackCta("hero_try_demo", "#try-it")}
              >
                Play with the board
              </a>
            </div>
          </div>

          <div className="scroll-mt-24" id="try-it">
            <MiniKanbanPlayground
              phase={phase}
              onAdvance={advanceDemo}
              onSelectCard={() => {
                if (phase === "banked") updatePhase("choose", "kanban_card");
              }}
            />
          </div>
        </div>
      </section>

      <section className="border-b border-[#e8e8e6] bg-white px-4 py-16 md:px-8 md:py-24" id="how-it-works">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
            <div className="max-w-xl">
              <p className="text-sm font-bold uppercase tracking-[0.12em] text-[#d90050]">
                And then it starts to add up
              </p>
              <h2 className="mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
                A good week looks good on you.
              </h2>
            </div>
            <p className="max-w-2xl text-lg leading-8 text-[#62605b] lg:justify-self-end">
              Every finished timer and completed card leaves a mark. The graph
              makes it easy to see when you are finding a rhythm without turning
              a quiet day into a guilt trip.
            </p>
          </div>

          <div className="mt-12">
            <MomentumPlayground phase={phase} />
          </div>

          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {focusLoop.map((step) => {
              const Icon = step.icon;
              const active = phase === step.id;

              return (
                <button
                  key={step.id}
                  aria-pressed={active}
                  className={`group rounded-3xl border p-6 text-left transition duration-300 focus:outline-none focus:ring-2 focus:ring-[#ff005e] focus:ring-offset-2 ${
                    active
                      ? "-translate-y-1 border-[#ff005e] bg-[#fff7fa] shadow-[0_20px_50px_rgba(255,0,94,0.12)]"
                      : "border-[#e3e3df] bg-[#fbfbf9] hover:-translate-y-1 hover:border-[#ff9ebe] hover:bg-white"
                  }`}
                  type="button"
                  onClick={() => updatePhase(step.id, "focus_loop")}
                >
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl transition ${
                      active ? "bg-[#ff005e] text-white" : "bg-[#fff0f5] text-[#ff005e]"
                    }`}
                  >
                    <Icon size={22} aria-hidden="true" />
                  </span>
                  <span className="mt-6 block text-sm font-bold uppercase tracking-[0.1em] text-[#d90050]">
                    {step.eyebrow}
                  </span>
                  <span className="mt-2 block text-xl font-semibold text-[#252724]">
                    {step.title}
                  </span>
                  <span className="mt-3 block text-base leading-7 text-[#62605b]">
                    {step.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-b border-[#e8e8e6] px-4 py-16 md:px-8 md:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-20">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.12em] text-[#d90050]">
              A score with a point of view
            </p>
            <h2 className="mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
              More hours are not the goal.
            </h2>
            <p className="mt-5 text-lg leading-8 text-[#62605b]">
              Tockli rewards a repeatable rhythm: showing up on the days you
              chose, reaching a sensible session goal, finishing cards, and
              following sessions through.
            </p>
            <div className="mt-7 rounded-2xl border border-[#ffe0ac] bg-[#fff8e9] p-5">
              <p className="flex items-center gap-2 text-base font-bold text-[#7a5200]">
                <TrendingUp size={19} aria-hidden="true" />
                One useful next step
              </p>
              <p className="mt-2 text-base leading-7 text-[#664f23]">
                {phase === "banked"
                  ? "You reached today’s goal. Protect the same first block tomorrow."
                  : phase === "focus"
                    ? "You showed up. Finish this block before adding more work."
                    : "Choose one finishable card and make the first session easy to start."}
              </p>
            </div>
          </div>

          <div className="rounded-[28px] border border-[#dededa] bg-white p-6 shadow-[0_24px_70px_rgba(26,28,27,0.10)] sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.1em] text-[#77746e]">
                  Rolling seven days
                </p>
                <p className="mt-1 text-2xl font-semibold">Focus score</p>
              </div>
              <div
                aria-label={`Demo focus score ${score} out of 100`}
                className="grid h-20 w-20 place-items-center rounded-full p-1.5"
                role="img"
                style={{
                  background: `conic-gradient(#ff005e ${score}%, #ececea ${score}% 100%)`,
                }}
              >
                <div className="grid h-full w-full place-items-center rounded-full bg-white text-2xl font-bold">
                  {score}
                </div>
              </div>
            </div>

            <div className="mt-7 space-y-5">
              {scoreComponents.map((component, index) => {
                const baseRatio = [0.8, 0.65, 0.7, 0.9][index];
                const ratio = Math.min(1, baseRatio + (phase === "banked" ? 0.15 : phase === "focus" ? 0.06 : 0));
                return (
                  <div key={component.id}>
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="font-semibold text-[#393b38]">{component.label}</span>
                      <span className="font-bold text-[#77746e]">
                        {Math.round(component.weight * ratio)}/{component.weight}
                      </span>
                    </div>
                    <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-[#ececea]">
                      <div
                        className="h-full rounded-full bg-[#ff005e] transition-[width] duration-500"
                        style={{ width: `${ratio * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#171918] px-4 py-16 text-white md:px-8 md:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_0%,rgba(255,0,94,0.34),transparent_42%),radial-gradient(circle_at_80%_100%,rgba(47,111,237,0.20),transparent_40%)]" aria-hidden="true" />
        <div className="relative mx-auto flex max-w-4xl flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ff005e] text-white shadow-[0_16px_40px_rgba(255,0,94,0.3)]">
            <TimerReset size={26} aria-hidden="true" />
          </span>
          <h2 className="mt-7 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
            Ready to get a few cards moving?
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-white/70">
            Make your first board and start a timer. By the end of the week,
            you might surprise yourself.
          </p>
          <Link
            className="mt-8 flex min-h-12 items-center rounded-xl bg-white px-6 py-3 text-sm font-bold text-[#d90050] transition hover:-translate-y-0.5 hover:bg-[#fff0f5]"
            href="/signup"
            onClick={() => trackCta("closing_signup", "/signup")}
          >
            Give Tockli a try
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
