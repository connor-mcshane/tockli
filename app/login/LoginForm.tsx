"use client";

import {
  ArrowRight,
  CheckCircle2,
  LockKeyhole,
  LogIn,
  Mail,
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import MarketingHeader from "@/app/MarketingHeader";
import { trackEvent } from "@/lib/analytics";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type LoginStatus = "idle" | "submitting" | "success" | "error";

function getSafeNext(value: string | null) {
  if (value?.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  return "/app";
}

function getAuthRedirect(nextPath: string) {
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(
    nextPath,
  )}`;
}

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nextPath, setNextPath] = useState("/app");
  const [status, setStatus] = useState<LoginStatus>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const messageParam = params.get("message");
    const safeNext = getSafeNext(params.get("next"));
    window.requestAnimationFrame(() => {
      setNextPath(safeNext);
      if (messageParam) {
        setMessage(messageParam);
      }
    });
    trackEvent("page_view", { surface: "login" });
  }, []);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!supabase) {
      setStatus("error");
      setMessage("Supabase auth is not configured for this deployment yet.");
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setStatus("error");
      setMessage("Enter a valid email address.");
      return;
    }

    setStatus("submitting");
    setMessage("");
    trackEvent("login_started", { method: "email_password" });

    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      trackEvent("login_failed", {
        method: "email_password",
        reason: error.message,
      });
      setStatus("error");
      setMessage(error.message);
      return;
    }

    trackEvent("login_succeeded", { method: "email_password" });
    setStatus("success");
    setMessage("Signed in. Opening your workspace...");
    window.setTimeout(() => window.location.assign(nextPath), 500);
  }

  async function startGoogleLogin() {
    trackEvent("oauth_started", {
      provider: "google",
      surface: "login",
      supabase_configured: isSupabaseConfigured,
    });

    if (!supabase) {
      setStatus("error");
      setMessage("Add Supabase env vars before enabling Google login.");
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getAuthRedirect(nextPath),
      },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
    }
  }

  async function requestPasswordReset() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!supabase) {
      setStatus("error");
      setMessage("Supabase auth is not configured for this deployment yet.");
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setStatus("error");
      setMessage("Enter your email first, then request a reset link.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${window.location.origin}/login`,
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    trackEvent("password_reset_requested", { surface: "login" });
    setStatus("success");
    setMessage("Password reset email sent.");
  }

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-[#1a1c1b]">
      <MarketingHeader />

      <section className="mx-auto grid min-h-[calc(100svh-4rem)] max-w-7xl items-center gap-10 px-4 py-10 md:px-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(400px,460px)]">
        <div>
          <p className="text-sm font-semibold uppercase text-[#b90042]">
            Welcome back
          </p>
          <h1 className="mt-3 max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">
            Log in and pick up your next focus block.
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-8 text-[#62605b]">
            Return to your task board, start the next timer, and keep momentum
            without rebuilding the plan from scratch.
          </p>
          <div className="mt-8 overflow-hidden rounded-lg border border-[#d8d7d3] bg-white shadow-[0_18px_60px_rgba(26,28,27,0.1)]">
            <div className="border-b border-[#e8e8e6] bg-[#f4f4f2] px-4 py-3 text-xs font-semibold uppercase text-[#6a6965]">
              Today in Tockli
            </div>
            <div className="grid gap-0 divide-y divide-[#e8e8e6] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {[
                ["3", "focus sessions"],
                ["72m", "protected time"],
                ["5", "notes saved"],
              ].map(([value, label]) => (
                <div key={label} className="p-4">
                  <div className="text-2xl font-semibold">{value}</div>
                  <div className="mt-1 text-sm text-[#62605b]">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-[#e8e8e6] bg-white p-5 shadow-[0_14px_40px_rgba(26,28,27,0.08)]">
          <button
            className="flex h-12 w-full items-center justify-center gap-2 rounded-md border border-[#d8d7d3] bg-white text-sm font-semibold text-[#1a1c1b] transition enabled:hover:border-[#ff005e] enabled:hover:text-[#ff005e] disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            onClick={startGoogleLogin}
          >
            <LogIn size={18} aria-hidden="true" />
            Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase text-[#8b8984]">
            <span className="h-px flex-1 bg-[#e8e8e6]" />
            or use email
            <span className="h-px flex-1 bg-[#e8e8e6]" />
          </div>

          <form className="space-y-4" onSubmit={submitLogin}>
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
                  placeholder="Your password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
            </label>

            <button
              className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#ff005e] px-4 text-sm font-semibold text-white transition enabled:hover:bg-[#e00054] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={status === "submitting"}
              type="submit"
            >
              {status === "submitting" ? "Signing in..." : "Log in"}
              <ArrowRight size={17} aria-hidden="true" />
            </button>
          </form>

          <button
            className="mt-4 w-full text-center text-sm font-semibold text-[#62605b] transition hover:text-[#ff005e]"
            type="button"
            onClick={requestPasswordReset}
          >
            Send password reset email
          </button>

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
            New to Tockli?{" "}
            <Link className="font-semibold text-[#ff005e]" href="/signup">
              Create an account
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
