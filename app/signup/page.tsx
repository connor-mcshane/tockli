import type { Metadata } from "next";
import SignupForm from "./SignupForm";

export const metadata: Metadata = {
  title: "Create a Tockli Account",
  description:
    "Create a Tockli account for the focus timer, task board, session notes, sharing, and practical analytics beta.",
  alternates: {
    canonical: "/signup",
  },
  openGraph: {
    title: "Create a Tockli Account",
    description:
      "Get early access to Tockli and help shape the calmer focus workspace.",
    images: ["/og.png"],
    url: "/signup",
  },
};

export default function SignupPage() {
  return <SignupForm />;
}
