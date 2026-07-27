"use client";

import { ANONYMOUS_ID_KEY, LEGACY_ANONYMOUS_ID_KEY } from "@/lib/analytics";

export type ExperimentVariant = {
  id: string;
  label: string;
};

export type ExperimentDefinition<TVariant extends ExperimentVariant> = {
  id: string;
  variants: readonly TVariant[];
};

const ASSIGNMENT_KEY = "tockli.experiments";
const LEGACY_ASSIGNMENT_KEY = "flowtimer.experiments";

function hash(value: string) {
  let total = 0;

  for (let index = 0; index < value.length; index += 1) {
    total = (total << 5) - total + value.charCodeAt(index);
    total |= 0;
  }

  return Math.abs(total);
}

function readAssignments() {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const stored =
      window.localStorage.getItem(ASSIGNMENT_KEY) ??
      window.localStorage.getItem(LEGACY_ASSIGNMENT_KEY);

    if (stored) {
      window.localStorage.setItem(ASSIGNMENT_KEY, stored);
      window.localStorage.removeItem(LEGACY_ASSIGNMENT_KEY);
    }

    return JSON.parse(stored ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function writeAssignments(assignments: Record<string, string>) {
  try {
    window.localStorage.setItem(ASSIGNMENT_KEY, JSON.stringify(assignments));
  } catch {
    // Experiment assignment can fall back to the deterministic hash.
  }
}

export function getExperimentVariant<TVariant extends ExperimentVariant>(
  experiment: ExperimentDefinition<TVariant>,
) {
  const fallback = experiment.variants[0];
  if (!fallback) {
    throw new Error(`Experiment ${experiment.id} has no variants.`);
  }

  if (typeof window === "undefined") {
    return fallback;
  }

  const assignments = readAssignments();
  const storedVariant = experiment.variants.find(
    (variant) => variant.id === assignments[experiment.id],
  );

  if (storedVariant) {
    return storedVariant;
  }

  const salt = process.env.NEXT_PUBLIC_EXPERIMENT_SALT ?? "tockli-launch";
  const anonymousSeed =
    window.localStorage.getItem(ANONYMOUS_ID_KEY) ??
    window.localStorage.getItem(LEGACY_ANONYMOUS_ID_KEY) ??
    window.navigator.userAgent;
  const variant =
    experiment.variants[
      hash(`${salt}:${experiment.id}:${anonymousSeed}`) % experiment.variants.length
    ] ?? fallback;

  writeAssignments({ ...assignments, [experiment.id]: variant.id });
  return variant;
}

export const landingHeroExperiment = {
  id: "landing-hero-2026-07",
  variants: [
    {
      id: "task-first",
      label: "Task-first promise",
      eyebrow: "Focus starts from the card",
      headline: "Turn a messy task list into one protected focus block.",
      cta: "Join early access",
    },
    {
      id: "rhythm-first",
      label: "Rhythm-first promise",
      eyebrow: "A quieter rhythm for deep work",
      headline: "Plan the work, run the timer, keep the proof.",
      cta: "Start with Tockli",
    },
  ],
} as const;
