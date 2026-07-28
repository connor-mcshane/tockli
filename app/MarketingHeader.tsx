"use client";

import { ArrowRight, Menu, TimerReset } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { trackEvent } from "@/lib/analytics";

const navigation = [
  { href: "/#about", label: "About" },
  { href: "/blog", label: "Blog" },
  { href: "/login", label: "Log in" },
];

export default function MarketingHeader() {
  const pathname = usePathname();

  function trackNavigation(label: string, destination: string) {
    trackEvent("cta_clicked", {
      cta: `marketing_header_${label.toLowerCase().replaceAll(" ", "_")}`,
      destination,
      surface: pathname,
    });
  }

  return (
    <header className="border-b border-[#e8e8e6] bg-white px-4 md:px-8">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4">
        <Link
          className="flex shrink-0 items-center gap-3"
          href="/"
          onClick={() => trackNavigation("logo", "/")}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#ff005e] text-white">
            <TimerReset size={20} aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold">Tockli</span>
        </Link>

        <nav
          aria-label="Primary navigation"
          className="hidden items-center gap-7 md:flex"
        >
          {navigation.map((item) => {
            const isActive =
              item.href === "/blog" && pathname.startsWith("/blog");

            return (
              <Link
                key={item.href}
                className={`text-sm font-semibold transition hover:text-[#ff005e] ${
                  isActive ? "text-[#ff005e]" : "text-[#62605b]"
                }`}
                href={item.href}
                onClick={() => trackNavigation(item.label, item.href)}
              >
                {item.label}
              </Link>
            );
          })}
          <Link
            className="flex h-10 items-center gap-2 rounded-md bg-[#ff005e] px-4 text-sm font-semibold text-white transition hover:bg-[#e00054]"
            href="/signup"
            onClick={() => trackNavigation("get_started", "/signup")}
          >
            Get started for free
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </nav>

        <details className="group relative md:hidden">
          <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-md border border-[#e8e8e6] text-[#4f4d49] transition hover:border-[#ff005e] hover:text-[#ff005e] [&::-webkit-details-marker]:hidden">
            <Menu size={20} aria-hidden="true" />
            <span className="sr-only">Open navigation</span>
          </summary>
          <nav
            aria-label="Mobile navigation"
            className="absolute right-0 z-30 mt-2 flex w-60 flex-col rounded-md border border-[#dededa] bg-white p-2 shadow-[0_14px_40px_rgba(26,28,27,0.14)]"
          >
            {navigation.map((item) => (
              <Link
                key={item.href}
                className="rounded-md px-3 py-3 text-sm font-semibold text-[#4f4d49] hover:bg-[#f7f7f5] hover:text-[#ff005e]"
                href={item.href}
                onClick={() => trackNavigation(item.label, item.href)}
              >
                {item.label}
              </Link>
            ))}
            <Link
              className="mt-1 flex h-11 items-center justify-center gap-2 rounded-md bg-[#ff005e] px-3 text-sm font-semibold text-white"
              href="/signup"
              onClick={() => trackNavigation("get_started", "/signup")}
            >
              Get started for free
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
