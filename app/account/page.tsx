import type { Metadata } from "next";
import AccountClient from "./AccountClient";

export const metadata: Metadata = {
  title: "Account Management | Tockli",
  description: "Manage your Tockli account, profile, and plan settings.",
};

export default function AccountPage() {
  return <AccountClient />;
}
