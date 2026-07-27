"use client";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  LockKeyhole,
  LogIn,
  Mail,
  TimerReset,
  User,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { getExperimentVariant, landingHeroExperiment } from "@/lib/experiments";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type SignupStatus = "idle" | "submitting" | "success" | "error";

const LOCAL_SIGNUPS_KEY = "tockli.localSignups";
const LEGACY_LOCAL_SIGNUPS_KEY = "flowtimer.localSignups";

const roleOptions = [
  "Solo founder",
  "Designer",
  "Engineer",
  "Student",
  "Team lead",
  "Other",
];

function isDuplicateSignup(error: { code?: string; message?: string }) {
  return error.code === "23505" || /duplicate|unique/i.test(error.message ?? "");
}

function getAuthRedirect() {
  return `${window.location.origin}/auth/callback?next=/app`;
}

export default function SignupForm() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(roleOptions[0]);
  const [intent, setIntent] = useState("personal-focus");
  const [status, setStatus] = useState<SignupStatus>("idle");
  const [message, setMessage] = useState("");
  const [source, setSource] = useState("direct");
  const [experiment, setExperiment] = useState<{ id: string; variant: string }>({
    id: landingHeroExperiment.id,
    variant: landingHeroExperiment.variants[0].id,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const assignedVariant = getExperimentVariant(landingHeroExperiment);
    const sourceParam = params.get("source");
    window.requestAnimationFrame(() => {
      setSource(sourceParam ?? (document.referrer ? "referral" : "direct"));
      setExperiment({
        id: landingHeroExperiment.id,
        variant: assignedVariant.id,
      });
    });
    trackEvent("page_view", { surface: "signup" });
  }, []);

  async function captureMarketingIntent(normalizedEmail: string) {
    const payload = {
      email: normalizedEmail,
      role,
      intent,
      source,
      experiment_id: experiment.id,
      experiment_variant: experiment.variant,
    };

    if (supabase) {
      const { error } = await supabase.from("marketing_signups").insert(payload);
      if (error && !isDuplicateSignup(error)) {
        console.warn("[Tockli signup] marketing capture failed", error.message);
      }
      return;
    }

    if (process.env.NEXT_PUBLIC_SIGNUP_ENDPOINT) {
      const response = await fetch(process.env.NEXT_PUBLIC_SIGNUP_ENDPOINT, {
        body: JSON.stringify(payload),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Signup endpoint rejected the request.");
      }
      return;
    }

    const storedSignups =
      window.localStorage.getItem(LOCAL_SIGNUPS_KEY) ??
      window.localStorage.getItem(LEGACY_LOCAL_SIGNUPS_KEY);
    const localSignups = JSON.parse(
      storedSignups ?? "[]",
    ) as Array<Record<string, string>>;
    window.localStorage.setItem(
      LOCAL_SIGNUPS_KEY,
      JSON.stringify([
        ...localSignups.filter((signup) => signup.email !== normalizedEmail),
        payload,
      ]),
    );
    window.localStorage.removeItem(LEGACY_LOCAL_SIGNUPS_KEY);
  }

  async function submitSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = displayName.trim();

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setStatus("error");
      setMessage("Enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      setStatus("error");
      setMessage("Use at least 8 characters for your password.");
      return;
    }

    setStatus("submitting");
    setMessage("");
    trackEvent("signup_started", {
      method: "email_password",
      role,
      intent,
      source,
      experiment_id: experiment.id,
      variant: experiment.variant,
    });
    trackEvent("auth_signup_started", {
      method: "email_password",
      role,
      intent,
      source,
    });

    try {
      if (!supabase) {
        await captureMarketingIntent(normalizedEmail);
        trackEvent("signup_submitted", {
          method: "local",
          role,
          intent,
          source,
          experiment_id: experiment.id,
          variant: experiment.variant,
        });
        setStatus("success");
        setMessage("Signup intent saved locally. Add Supabase env vars to create accounts.");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            display_name: normalizedName || normalizedEmail.split("@")[0],
            intent,
            role,
          },
          emailRedirectTo: getAuthRedirect(),
        },
      });

      if (error) {
        throw error;
      }

      await captureMarketingIntent(normalizedEmail);
      trackEvent("signup_submitted", {
        method: "supabase_auth",
        role,
        intent,
        source,
        experiment_id: experiment.id,
        variant: experiment.variant,
      });
      trackEvent("auth_signup_succeeded", {
        method: "email_password",
        has_session: Boolean(data.session),
      });

      setStatus("success");
      if (data.session) {
        setMessage("Account created. Opening your workspace...");
        window.setTimeout(() => window.location.assign("/app"), 600);
      } else {
        setMessage("Account created. Check your email to confirm, then log in.");
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown";
      trackEvent("signup_failed", {
        method: supabase ? "supabase_auth" : "email",
        reason,
      });
      trackEvent("auth_signup_failed", {
        method: "email_password",
        reason,
      });
      setStatus("error");
      setMessage(reason);
    }
  }

  async function startGoogleSignup() {
    trackEvent("google_signup_clicked", {
      supabase_configured: isSupabaseConfigured,
      source,
    });
    trackEvent("oauth_started", {
      provider: "google",
      surface: "signup",
    });

    if (!supabase) {
      setStatus("error");
      setMessage("Add Supabase env vars before enabling Google signup.");
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getAuthRedirect(),
      },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-[#1a1c1b]">
      <header className="border-b border-[#e8e8e6] bg-white px-4 md:px-8">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between">
          <Link className="flex items-center gap-3" href="/">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#ff005e] text-white">
              <TimerReset size={20} aria-hidden="true" />
            </span>
            <span className="text-lg font-semibold">Tockli</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              className="hidden h-10 items-center gap-2 rounded-md border border-[#e8e8e6] bg-white px-4 text-sm font-semibold text-[#62605b] transition hover:border-[#ff005e] hover:text-[#ff005e] sm:flex"
              href="/"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              Home
            </Link>
            <Link
              className="flex h-10 items-center gap-2 rounded-md bg-[#1a1c1b] px-4 text-sm font-semibold text-white transition hover:bg-[#343634]"
              href="/login"
            >
              <LogIn size={16} aria-hidden="true" />
              Log in
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:px-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:py-16">
        <div className="order-2 overflow-hidden rounded-lg border border-[#e8e8e6] bg-white lg:order-1">
          <Image
            alt="Tockli task board preview."
            className="h-full min-h-80 w-full object-cover object-left-top"
            height={720}
            src="/tockli-preview.png"
            width={1280}
          />
        </div>

        <div className="order-1 lg:order-2">
          <p className="text-sm font-semibold uppercase text-[#b90042]">
            Create account
          </p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">
            Sign up for Tockli.
          </h1>
          <p className="mt-4 text-lg leading-8 text-[#62605b]">
            Create an account for the hosted beta, and tell us how you want to
            use the workspace so onboarding can stay focused.
          </p>

          <div className="mt-8 rounded-lg border border-[#e8e8e6] bg-white p-5 shadow-[0_14px_40px_rgba(26,28,27,0.08)]">
            <button
              className="flex h-12 w-full items-center justify-center gap-2 rounded-md border border-[#d8d7d3] bg-white text-sm font-semibold text-[#1a1c1b] transition enabled:hover:border-[#ff005e] enabled:hover:text-[#ff005e] disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              onClick={startGoogleSignup}
            >
              <LogIn size={18} aria-hidden="true" />
              Continue with Google
            </button>

            <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase text-[#8b8984]">
              <span className="h-px flex-1 bg-[#e8e8e6]" />
              or use email
              <span className="h-px flex-1 bg-[#e8e8e6]" />
            </div>

            <form className="space-y-4" onSubmit={submitSignup}>
              <label className="block">
                <span className="text-sm font-semibold text-[#62605b]">Name</span>
                <div className="mt-2 flex h-12 items-center gap-2 rounded-md border border-[#e8e8e6] bg-[#f9f9f7] px-3 focus-within:border-[#ff005e]">
                  <User size={17} aria-hidden="true" />
                  <input
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#8b8984]"
                    placeholder="Ada Lovelace"
                    type="text"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-[#62605b]">Email</span>
                <div className="mt-2 flex h-12 items-center gap-2 rounded-md border border-[#e8e8e6] bg-[#f9f9f7] px-3 focus-within:border-[#ff005e]">
                  <Mail size={17} aria-hidden="true" />
                  <input
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#8b8984]"
                    placeholder="you@example.com"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-[#62605b]">
                  Password
                </span>
                <div className="mt-2 flex h-12 items-center gap-2 rounded-md border border-[#e8e8e6] bg-[#f9f9f7] px-3 focus-within:border-[#ff005e]">
                  <LockKeyhole size={17} aria-hidden="true" />
                  <input
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#8b8984]"
                    placeholder="At least 8 characters"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-[#62605b]">Role</span>
                  <select
                    className="mt-2 h-12 w-full rounded-md border border-[#e8e8e6] bg-[#f9f9f7] px-3 text-sm outline-none transition focus:border-[#ff005e]"
                    value={role}
                    onChange={(event) => setRole(event.target.value)}
                  >
                    {roleOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-[#62605b]">Use case</span>
                  <select
                    className="mt-2 h-12 w-full rounded-md border border-[#e8e8e6] bg-[#f9f9f7] px-3 text-sm outline-none transition focus:border-[#ff005e]"
                    value={intent}
                    onChange={(event) => setIntent(event.target.value)}
                  >
                    <option value="personal-focus">Personal focus</option>
                    <option value="shared-project">Shared project</option>
                    <option value="team-rhythm">Team rhythm</option>
                  </select>
                </label>
              </div>

              <button
                className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#ff005e] px-4 text-sm font-semibold text-white transition enabled:hover:bg-[#e00054] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={status === "submitting"}
                type="submit"
              >
                {status === "submitting" ? "Creating..." : "Create account"}
                <ArrowRight size={17} aria-hidden="true" />
              </button>
            </form>

            {message ? (
              <div
                className={`mt-4 flex items-start gap-2 rounded-md border p-3 text-sm ${
                  status === "success"
                    ? "border-[#c9ecd6] bg-[#edf8f1] text-[#256b43]"
                    : "border-[#ffd3df] bg-[#fff0f5] text-[#b90042]"
                }`}
                role="status"
              >
                {status === "success" ? (
                  <CheckCircle2 size={17} aria-hidden="true" />
                ) : null}
                <span>{message}</span>
              </div>
            ) : null}

            <p className="mt-5 text-center text-sm text-[#62605b]">
              Already have an account?{" "}
              <Link className="font-semibold text-[#ff005e]" href="/login">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
