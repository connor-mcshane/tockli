"use client";

import {
  ArrowRight,
  BarChart3,
  Check,
  Clock3,
  FolderKanban,
  Gauge,
  RotateCcw,
  Sparkles,
  Target,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import MarketingFooter from "@/app/MarketingFooter";
import MarketingHeader from "@/app/MarketingHeader";
import { trackEvent } from "@/lib/analytics";
import {
  DEFAULT_FOCUS_SCORE_ESTIMATE,
  ESTIMATOR_DAILY_GOAL,
  estimateFocusScore,
  normalizeFocusScoreEstimate,
} from "@/lib/focus-score-estimator.mjs";

const focusLoop = [
  {
    title: "Choose",
    description: "Pick the one card that matters right now.",
    icon: FolderKanban,
  },
  {
    title: "Focus",
    description: "Protect one block of time and finish the session.",
    icon: Clock3,
  },
  {
    title: "Bank it",
    description: "Finish the card, grow your score, and keep the streak alive.",
    icon: BarChart3,
  },
];

type EstimatorAnswers = typeof DEFAULT_FOCUS_SCORE_ESTIMATE;

type ScoreRangeProps = {
  description: string;
  id: string;
  label: string;
  max: number;
  min?: number;
  value: number;
  valueLabel: string;
  onChange: (value: number) => void;
};

function ScoreRange({
  description,
  id,
  label,
  max,
  min = 0,
  value,
  valueLabel,
  onChange,
}: ScoreRangeProps) {
  return (
    <label className="block" htmlFor={id}>
      <span className="flex items-start justify-between gap-4">
        <span>
          <span className="block text-sm font-semibold text-[#252724]">{label}</span>
          <span className="mt-0.5 block text-xs leading-5 text-[#77746e]">
            {description}
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-[#fff0f5] px-3 py-1 text-sm font-bold text-[#d90050]">
          {valueLabel}
        </span>
      </span>
      <input
        aria-valuetext={valueLabel}
        className="mt-3 h-2 w-full cursor-pointer accent-[#ff005e]"
        id={id}
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        type="range"
        value={value}
      />
    </label>
  );
}

function plural(value: number, singular: string, pluralForm = `${singular}s`) {
  return `${value} ${value === 1 ? singular : pluralForm}`;
}

export default function LandingPageClient() {
  const [answers, setAnswers] = useState<EstimatorAnswers>(
    DEFAULT_FOCUS_SCORE_ESTIMATE,
  );
  const [revealed, setRevealed] = useState(false);
  const estimate = useMemo(() => estimateFocusScore(answers), [answers]);

  useEffect(() => {
    trackEvent("page_view", { surface: "landing" });
  }, []);

  function trackCta(cta: string, destination: string) {
    trackEvent("cta_clicked", {
      cta,
      destination,
      surface: "landing",
    });
  }

  function updateAnswers(update: Partial<EstimatorAnswers>) {
    setAnswers((current) =>
      normalizeFocusScoreEstimate({ ...current, ...update }),
    );
  }

  function revealScore() {
    setRevealed(true);
    trackEvent("focus_score_estimated", {
      score: estimate.score,
      work_days: estimate.answers.workDays,
      active_days: estimate.answers.activeDays,
      goal_days: estimate.answers.goalDays,
      completed_tasks: estimate.answers.completedTasks,
      abandoned_sessions: estimate.answers.abandonedSessions,
      surface: "landing",
    });
  }

  function resetEstimator() {
    setAnswers(DEFAULT_FOCUS_SCORE_ESTIMATE);
    setRevealed(false);
  }

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-[#1a1c1b]">
      <MarketingHeader />

      <section className="overflow-hidden border-b border-[#e8e8e6] px-4 py-12 md:px-8 md:py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#ffd0e1] bg-[#fff0f5] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[#d90050]">
              <Sparkles size={14} aria-hidden="true" />
              Free 20-second check-in
            </p>
            <h1 className="mt-5 text-5xl font-semibold leading-[0.98] tracking-[-0.04em] text-[#111312] sm:text-6xl lg:text-7xl">
              Find out your focus score.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#4f4d49] sm:text-xl">
              Did you show up, hit your session goals, and finish the work? Get
              one weekly score—and the next move that will improve it.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3 text-sm font-semibold text-[#62605b]">
              <span className="flex items-center gap-2">
                <Check className="text-[#12805c]" size={17} aria-hidden="true" />
                Rest days never count against you
              </span>
              <span className="flex items-center gap-2">
                <Check className="text-[#12805c]" size={17} aria-hidden="true" />
                No signup to see your score
              </span>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                className="flex h-12 items-center gap-2 rounded-md bg-[#ff005e] px-5 text-sm font-semibold text-white transition hover:bg-[#e00054]"
                href="#focus-score"
                onClick={() => trackCta("hero_calculate_score", "#focus-score")}
              >
                Calculate my score
                <ArrowRight size={17} aria-hidden="true" />
              </a>
              <Link
                className="flex h-12 items-center rounded-md border border-[#d7d7d2] bg-white px-5 text-sm font-semibold text-[#393b38] transition hover:border-[#ff005e] hover:text-[#d90050]"
                href="/signup"
                onClick={() => trackCta("hero_signup", "/signup")}
              >
                Get started for free
              </Link>
            </div>
          </div>

          <div
            className="scroll-mt-6 rounded-2xl border border-[#dededa] bg-white p-5 shadow-[0_24px_70px_rgba(26,28,27,0.12)] sm:p-7"
            id="focus-score"
          >
            <div className="flex items-center justify-between gap-4 border-b border-[#ececea] pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#d90050]">
                  Your last 7 days
                </p>
                <h2 className="mt-1 text-xl font-semibold">Quick score check</h2>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#fff0f5] text-[#ff005e]">
                <Gauge size={22} aria-hidden="true" />
              </span>
            </div>

            {!revealed ? (
              <div className="mt-6 space-y-6">
                <ScoreRange
                  description="Days you intended to work—not rest days."
                  id="score-work-days"
                  label="Planned workdays"
                  max={7}
                  min={1}
                  onChange={(workDays) => updateAnswers({ workDays })}
                  value={answers.workDays}
                  valueLabel={plural(answers.workDays, "day")}
                />
                <ScoreRange
                  description="Days when you completed at least one focus session."
                  id="score-active-days"
                  label="Days you showed up"
                  max={answers.workDays}
                  onChange={(activeDays) => updateAnswers({ activeDays })}
                  value={answers.activeDays}
                  valueLabel={plural(answers.activeDays, "day")}
                />
                <ScoreRange
                  description={`Days when you reached your target (we estimate ${ESTIMATOR_DAILY_GOAL} sessions).`}
                  id="score-goal-days"
                  label="Days you hit your session goal"
                  max={answers.activeDays}
                  onChange={(goalDays) => updateAnswers({ goalDays })}
                  value={answers.goalDays}
                  valueLabel={plural(answers.goalDays, "day")}
                />
                <div className="grid gap-6 sm:grid-cols-2">
                  <ScoreRange
                    description="Cards moved all the way to done."
                    id="score-completed-tasks"
                    label="Cards finished"
                    max={14}
                    onChange={(completedTasks) => updateAnswers({ completedTasks })}
                    value={answers.completedTasks}
                    valueLabel={`${answers.completedTasks}`}
                  />
                  <ScoreRange
                    description="Focus sessions stopped before the end."
                    id="score-abandoned-sessions"
                    label="Sessions abandoned"
                    max={12}
                    onChange={(abandonedSessions) =>
                      updateAnswers({ abandonedSessions })
                    }
                    value={answers.abandonedSessions}
                    valueLabel={`${answers.abandonedSessions}`}
                  />
                </div>
                <button
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#ff005e] px-5 text-sm font-semibold text-white transition hover:bg-[#e00054]"
                  onClick={revealScore}
                  type="button"
                >
                  Reveal my focus score
                  <ArrowRight size={17} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <div className="mt-6" aria-live="polite">
                <div className="flex flex-col items-center text-center">
                  <div
                    aria-label={`Focus score ${estimate.score} out of 100`}
                    className="grid h-40 w-40 place-items-center rounded-full p-3"
                    role="img"
                    style={{
                      background: `conic-gradient(#ff005e ${estimate.score}%, #f0efec ${estimate.score}% 100%)`,
                    }}
                  >
                    <div className="grid h-full w-full place-items-center rounded-full bg-white">
                      <div>
                        <p className="text-5xl font-bold tracking-[-0.05em] text-[#111312]">
                          {estimate.score}
                        </p>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#77746e]">
                          out of 100
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="mt-4 text-xl font-semibold">{estimate.band.label}</p>
                  <p className="mt-1 text-sm leading-6 text-[#62605b]">
                    Based on your last seven days. Keep the next one simple.
                  </p>
                </div>

                <div className="mt-7 space-y-4 border-t border-[#ececea] pt-6">
                  {estimate.components.map((component) => (
                    <div key={component.id}>
                      <div className="flex items-center justify-between gap-4 text-sm">
                        <span className="font-semibold">{component.label}</span>
                        <span className="font-bold text-[#4f4d49]">
                          {component.earned}/{component.possible}
                        </span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#ececea]">
                        <div
                          className="h-full rounded-full bg-[#ff005e] transition-[width]"
                          style={{ width: `${(component.ratio ?? 0) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {estimate.biggestOpportunity ? (
                  <div className="mt-6 rounded-xl border border-[#ffe0ac] bg-[#fff8e9] p-4 text-left">
                    <p className="flex items-center gap-2 text-sm font-bold text-[#7a5200]">
                      <Target size={17} aria-hidden="true" />
                      Your quickest win
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[#664f23]">
                      {estimate.biggestOpportunity.hint}
                    </p>
                  </div>
                ) : (
                  <div className="mt-6 rounded-xl border border-[#bde4d5] bg-[#ecf8f3] p-4 text-left">
                    <p className="text-sm font-bold text-[#126246]">A full-score week.</p>
                    <p className="mt-1 text-sm leading-6 text-[#285c49]">
                      Repeat the rhythm. More hours are not the goal.
                    </p>
                  </div>
                )}

                <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
                  <Link
                    className="flex h-12 items-center justify-center gap-2 rounded-md bg-[#ff005e] px-5 text-sm font-semibold text-white transition hover:bg-[#e00054]"
                    href="/signup"
                    onClick={() => trackCta("score_result_signup", "/signup")}
                  >
                    Start focusing for free
                    <ArrowRight size={17} aria-hidden="true" />
                  </Link>
                  <button
                    className="flex h-12 items-center justify-center gap-2 rounded-md border border-[#d7d7d2] bg-white px-4 text-sm font-semibold text-[#4f4d49] transition hover:border-[#ff005e] hover:text-[#d90050]"
                    onClick={resetEstimator}
                    type="button"
                  >
                    <RotateCcw size={16} aria-hidden="true" />
                    Edit answers
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section
        className="border-b border-[#e8e8e6] bg-white px-4 py-12 md:px-8"
        id="how-it-works"
      >
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#d90050]">
              Build the score
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              Pick a card. Run the timer. Bank the win.
            </h2>
            <p className="mt-3 text-base leading-7 text-[#62605b]">
              Tockli puts the task and the timer in the same loop, so progress
              is easy to start and impossible to fake.
            </p>
          </div>
          <div className="mt-9 grid gap-8 md:grid-cols-3">
            {focusLoop.map((step) => {
              const Icon = step.icon;

              return (
                <div key={step.title} className="flex items-start gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#fff0f5] text-[#ff005e]">
                    <Icon size={19} aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-base font-semibold">{step.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-[#62605b]">
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-b border-[#e8e8e6] px-4 py-14 md:px-8 md:py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <div className="overflow-hidden rounded-xl border border-[#dededa] bg-white p-2 shadow-[0_18px_50px_rgba(26,28,27,0.10)] md:p-3">
            <div className="relative aspect-video overflow-hidden rounded-lg border border-[#ececea] bg-[#f7f7f5]">
              <Image
                alt="Tockli task board with task columns, focus cards, and daily progress."
                className="object-cover object-center"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 700px"
                src="/tockli-preview.png"
              />
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#d90050]">
              Your score, explained
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              A score you can actually change.
            </h2>
            <p className="mt-4 text-base leading-7 text-[#62605b]">
              No points for looking busy. Your score mostly rewards showing up
              on the days you chose and hitting your session goal. Finishing
              cards and following sessions through make up the rest.
            </p>
            <dl className="mt-7 grid grid-cols-2 gap-3 text-sm">
              {[
                ["35 points", "Showing up"],
                ["30 points", "Daily session goal"],
                ["20 points", "Cards finished"],
                ["15 points", "Follow-through"],
              ].map(([value, label]) => (
                <div className="rounded-lg border border-[#e3e3df] bg-white p-4" key={label}>
                  <dt className="font-semibold text-[#62605b]">{label}</dt>
                  <dd className="mt-1 text-xl font-bold text-[#111312]">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section className="bg-[#ff005e] px-4 py-14 text-white md:px-8">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            Give tomorrow something to beat.
          </h2>
          <p className="mt-3 max-w-xl text-base leading-7 text-white/85">
            Make a board, finish your first focus session, and start building a
            score that means something.
          </p>
          <Link
            className="mt-7 flex h-12 items-center gap-2 rounded-md bg-white px-5 text-sm font-semibold text-[#d90050] transition hover:bg-[#fff0f5]"
            href="/signup"
            onClick={() => trackCta("closing_signup", "/signup")}
          >
            Get started for free
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
