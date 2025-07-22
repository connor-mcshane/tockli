"use client";

import { AlertCircle, TimerReset } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

function getSafeNext(value: string | null) {
  if (value?.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  return "/app";
}

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("Finishing sign in...");

  useEffect(() => {
    async function finishAuth() {
      if (!supabase) {
        setMessage("Supabase auth is not configured for this deployment.");
        return;
      }

      const url = new URL(window.location.href);
      const next = getSafeNext(url.searchParams.get("next"));
      const code = url.searchParams.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setMessage(error.message);
          return;
        }
      }

      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setMessage(error.message);
        return;
      }

      if (data.session) {
        window.location.replace(next);
        return;
      }

      window.location.replace(
        "/login?message=Sign%20in%20was%20not%20completed.%20Please%20try%20again.",
      );
    }

    void finishAuth();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f7f5] px-4 text-[#1a1c1b]">
      <section className="w-full max-w-md rounded-lg border border-[#e8e8e6] bg-white p-6 text-center shadow-[0_14px_40px_rgba(26,28,27,0.08)]">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-md bg-[#ff005e] text-white">
          <TimerReset size={22} aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold">Tockli</h1>
        <p className="mt-3 text-sm leading-6 text-[#62605b]">{message}</p>
        {message === "Finishing sign in..." ? null : (
          <div className="mt-5 flex items-center justify-center gap-2 text-sm text-[#b90042]">
            <AlertCircle size={16} aria-hidden="true" />
            <Link className="font-semibold underline" href="/login">
              Return to login
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
