import type { Metadata } from "next";
import SignupForm from "./SignupForm";

export const metadata: Metadata = {
  title: "Create a Tockli Account",
  description:
    "Create a Tockli account for the focus timer, task board, and session notes.",
  alternates: {
    canonical: "/signup",
  },
  openGraph: {
    title: "Create a Tockli Account",
    description:
      "Get early access to Tockli and improve your personal productivity.",
    images: ["/og.png"],
    url: "/signup",
  },
};

export default function SignupPage() {
  return <SignupForm />;
}
