import type { Metadata } from "next";
import SignupForm from "./SignupForm";

export const metadata: Metadata = {
  title: "Join Tockli Early Access",
  description:
    "Join the Tockli beta for a focus timer, task board, session notes, sharing, and practical analytics.",
  alternates: {
    canonical: "/signup",
  },
  openGraph: {
    title: "Join Tockli Early Access",
    description:
      "Get early access to Tockli and help shape the calmer focus workspace.",
    images: ["/og.png"],
    url: "/signup",
  },
};

export default function SignupPage() {
  return <SignupForm />;
}
