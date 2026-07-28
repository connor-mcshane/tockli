"use client";

import {
  ArrowLeft,
  CheckCircle2,
  Save,
  Settings,
  TimerReset,
  User,
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  email: string;
  display_name: string;
  plan: string;
};

export default function AccountClient() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;

    async function loadProfile() {
      if (!isSupabaseConfigured || !supabase) {
        setLoading(false);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        if (alive) {
          window.location.assign("/login?next=/account");
        }
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (alive) {
        if (data) {
          setProfile(data as Profile);
          setDisplayName(data.display_name || "");
        }
        setLoading(false);
      }
    }

    void loadProfile();

    return () => {
      alive = false;
    };
  }, []);

  async function handleSave(e: FormEvent) {
    e.preventDefault();

    if (!isSupabaseConfigured || !supabase || !profile) {
      return;
    }

    setStatus("saving");
    setMessage("");

    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName })
      .eq("id", profile.id);

    if (error) {
      setStatus("error");
      setMessage(error.message);
    } else {
      setStatus("success");
      setMessage("Profile updated successfully.");
      setProfile({ ...profile, display_name: displayName });
      trackEvent("settings_updated", {
        surface: "account_page",
      });
      
      setTimeout(() => {
        setStatus("idle");
        setMessage("");
      }, 3000);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f7f5] text-[#1a1c1b]">
        <div className="flex h-screen items-center justify-center">
          <p className="text-[#62605b]">Loading account details...</p>
        </div>
      </main>
    );
  }

  if (!profile && isSupabaseConfigured) {
    // Should be redirecting to login
    return null;
  }

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-[#1a1c1b]">
      <header className="border-b border-[#e8e8e6] bg-white px-4 md:px-8">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4">
          <Link className="flex items-center gap-3" href="/">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#ff005e] text-white">
              <TimerReset size={20} aria-hidden="true" />
            </span>
            <span className="text-lg font-semibold">Tockli</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-semibold text-[#62605b] md:flex">
            <Link className="transition hover:text-[#ff005e]" href="/app">
              Workspace
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-12 md:px-8">
        <div className="mb-8 flex items-center gap-4">
          <Link
            href="/app"
            className="flex h-10 w-10 items-center justify-center rounded-md border border-[#e8e8e6] bg-white text-[#62605b] transition hover:border-[#ff005e] hover:text-[#ff005e]"
            title="Back to workspace"
          >
            <ArrowLeft size={20} aria-hidden="true" />
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Account Management</h1>
        </div>

        <div className="grid gap-8 md:grid-cols-[1fr_300px]">
          <div className="space-y-6">
            {!isSupabaseConfigured ? (
              <div className="rounded-md border border-[#ff005e]/20 bg-[#ff005e]/5 p-4 text-sm text-[#ff005e]">
                <p className="font-semibold">Local Demo Mode</p>
                <p className="mt-1">
                  Account management requires Supabase to be configured. You are
                  currently in local demo mode.
                </p>
              </div>
            ) : null}

            <section className="rounded-xl border border-[#e8e8e6] bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center gap-3 border-b border-[#e8e8e6] pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f7f7f5] text-[#1a1c1b]">
                  <User size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Profile Information</h2>
                  <p className="text-sm text-[#62605b]">
                    Update your personal details.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-1 block text-sm font-semibold text-[#1a1c1b]"
                  >
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    disabled
                    value={profile?.email || ""}
                    className="w-full rounded-md border border-[#e8e8e6] bg-[#f9f9f7] px-3 py-2 text-sm text-[#62605b] opacity-70 outline-none"
                  />
                  <p className="mt-1 text-xs text-[#62605b]">
                    Your email address cannot be changed.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="displayName"
                    className="mb-1 block text-sm font-semibold text-[#1a1c1b]"
                  >
                    Display Name
                  </label>
                  <input
                    id="displayName"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    disabled={!isSupabaseConfigured || status === "saving"}
                    className="w-full rounded-md border border-[#e8e8e6] bg-white px-3 py-2 text-sm text-[#1a1c1b] outline-none transition focus:border-[#ff005e]"
                    required
                  />
                </div>

                {message ? (
                  <div
                    className={`flex items-center gap-2 rounded-md p-3 text-sm font-semibold ${
                      status === "error"
                        ? "bg-red-50 text-red-600"
                        : "bg-[#25a565]/10 text-[#25a565]"
                    }`}
                  >
                    {status === "success" && <CheckCircle2 size={16} />}
                    {message}
                  </div>
                ) : null}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={!isSupabaseConfigured || status === "saving" || displayName === profile?.display_name}
                    className="flex h-10 items-center justify-center gap-2 rounded-md bg-[#ff005e] px-4 text-sm font-semibold text-white transition hover:bg-[#e00054] disabled:opacity-50"
                  >
                    <Save size={16} />
                    {status === "saving" ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-xl border border-[#e8e8e6] bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f7f7f5] text-[#1a1c1b]">
                  <Settings size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Subscription</h2>
                </div>
              </div>
              <div className="rounded-md border border-[#e8e8e6] p-4 text-center">
                <div className="mb-1 text-sm font-medium text-[#62605b]">
                  Current Plan
                </div>
                <div className="text-2xl font-bold capitalize text-[#1a1c1b]">
                  {profile?.plan || "Free"}
                </div>
                {profile?.plan === "free" && (
                  <button
                    disabled
                    className="mt-4 w-full rounded-md border border-[#e8e8e6] bg-[#f9f9f7] px-3 py-2 text-sm font-semibold text-[#62605b] opacity-70"
                  >
                    Upgrade to Pro (Coming Soon)
                  </button>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
