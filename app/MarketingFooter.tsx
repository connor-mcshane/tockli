import Link from "next/link";
import { TimerReset } from "lucide-react";

const legalLinks = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/blog", label: "Blog" },
];

export default function MarketingFooter() {
  return (
    <footer
      className="scroll-mt-6 bg-[#171918] px-4 py-12 text-white md:px-8"
      id="about"
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <Link className="flex w-fit items-center gap-3" href="/">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#ff005e] text-white">
                <TimerReset size={20} aria-hidden="true" />
              </span>
              <span className="text-lg font-semibold">Tockli</span>
            </Link>
            <p className="mt-5 text-sm leading-6 text-[#b9bcb9]">
              Pick a card. Start the timer. Keep your focus streak moving.
            </p>
          </div>

          <nav aria-label="Legal navigation">
            <ul className="space-y-3 text-sm text-[#b9bcb9]">
              {legalLinks.map((link) => (
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
          <p>Personal productivity, without the admin.</p>
        </div>
      </div>
    </footer>
  );
}
