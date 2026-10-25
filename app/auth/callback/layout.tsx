import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    absolute: "Finishing sign in | Tockli",
  },
  robots: {
    follow: false,
    index: false,
    nocache: true,
  },
};

export default function AuthCallbackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
