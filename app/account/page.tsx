import type { Metadata } from "next";
import AccountClient from "./AccountClient";

export const metadata: Metadata = {
  title: {
    absolute: "Account management | Tockli",
  },
  description: "Manage your Tockli account, profile, and plan settings.",
  robots: {
    follow: false,
    index: false,
  },
};

export default function AccountPage() {
  return <AccountClient />;
}
