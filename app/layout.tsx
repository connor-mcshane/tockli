import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { getSiteUrl, siteConfig } from "@/lib/marketing";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Tockli - Focus timer and task board",
    template: "%s | Tockli",
  },
  description: siteConfig.description,
  applicationName: "Tockli",
  keywords: [
    "focus timer",
    "task board",
    "pomodoro timer",
    "deep work",
    "productivity app",
    "focus analytics",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Tockli - Focus timer and task board",
    description: siteConfig.description,
    images: [
      {
        alt: "Tockli task board and daily focus progress.",
        height: 720,
        url: siteConfig.ogImage,
        width: 1280,
      },
    ],
    locale: "en_US",
    siteName: "Tockli",
    type: "website",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tockli - Focus timer and task board",
    description: siteConfig.description,
    images: [siteConfig.ogImage],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>{children}</body>
    </html>
  );
}
