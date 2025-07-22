import Link from "next/link";
import { TimerReset } from "lucide-react";

const productLinks = [
  { href: "/#focus-score", label: "Focus score" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/blog", label: "Blog" },
];

const accountLinks = [
  { href: "/login", label: "Log in" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

export default function MarketingFooter() {
  return (
    <footer
      className="scroll-mt-6 bg-[#171918] px-4 py-12 text-white md:px-8"
      id="about"
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="max-w-sm">
            <Link className="flex w-fit items-center gap-3" href="/">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#ff005e] text-white">
                <TimerReset size={20} aria-hidden="true" />
              </span>
              <span className="text-lg font-semibold">Tockli</span>
            </Link>
            <p className="mt-5 text-sm leading-6 text-[#b9bcb9]">
              Turn the work you finish into a focus score you can improve.
            </p>
          </div>

          <nav aria-label="Product navigation">
            <h2 className="text-sm font-semibold">Product</h2>
            <ul className="mt-4 space-y-3 text-sm text-[#b9bcb9]">
              {productLinks.map((link) => (
                <li key={link.href}>
                  <Link className="transition hover:text-white" href={link.href}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Account and legal navigation">
            <h2 className="text-sm font-semibold">Tockli</h2>
            <ul className="mt-4 space-y-3 text-sm text-[#b9bcb9]">
              {accountLinks.map((link) => (
                <li key={link.href}>
                  <Link className="transition hover:text-white" href={link.href}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-white/15 pt-6 text-xs text-[#8e928e] sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Tockli.</p>
          <p>Show up. Focus. Finish.</p>
        </div>
      </div>
    </footer>
  );
}
