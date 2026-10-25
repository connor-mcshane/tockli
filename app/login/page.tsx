import type { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Log in to Tockli",
  description:
    "Log in to Tockli to open your focus timer, task board, session notes, and analytics workspace.",
  alternates: {
    canonical: "/login",
  },
  openGraph: {
    title: "Log in to Tockli",
    description:
      "Open your Tockli workspace and continue your next focused work session.",
    images: ["/og.png"],
    url: "/login",
  },
  robots: {
    follow: true,
    index: false,
  },
};

export default function LoginPage() {
  return <LoginForm />;
}
