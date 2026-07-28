import type { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Log in to Tockli",
  description:
    "Log in to Tockli to open your focus timer, task board, and session notes.",
  alternates: {
    canonical: "/login",
  },
  openGraph: {
    title: "Log in to Tockli",
    description:
      "Open your Tockli app and continue your next focused work session.",
    images: ["/og.png"],
    url: "/login",
  },
};

export default function LoginPage() {
  return <LoginForm />;
}
