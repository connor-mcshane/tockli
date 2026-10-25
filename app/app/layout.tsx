import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    absolute: "Tockli workspace",
  },
  robots: {
    follow: false,
    index: false,
    nocache: true,
  },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return children;
}
