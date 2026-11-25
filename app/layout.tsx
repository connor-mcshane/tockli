import type { Metadata } from "next";
import { Inter } from "next/font/google";
import AnalyticsConsentControl from "@/app/AnalyticsConsentControl";
import AnalyticsLifecycle from "@/app/AnalyticsLifecycle";
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
    default: "Tockli - Kanban board with a focus timer",
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
    "focus momentum",
    "habit tracker for work",
  ],
  openGraph: {
    title: "Tockli - Kanban board with a focus timer",
    description: siteConfig.description,
    images: [
      {
        alt: "Tockli Kanban board with a focus timer and momentum graph.",
        height: 720,
        url: siteConfig.ogImage,
        width: 1280,
      },
    ],
    locale: "en_US",
    siteName: "Tockli",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tockli - Kanban board with a focus timer",
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
      <body className={`${inter.variable} antialiased`}>
        <AnalyticsLifecycle />
        <AnalyticsConsentControl />
        {children}
      </body>
    </html>
  );
}
