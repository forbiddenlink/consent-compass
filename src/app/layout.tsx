import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import "./globals.css";
import { PostHogProvider } from "@/components/PostHogProvider";
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Consent Compass - Cookie Banner Compliance Scanner",
  description:
    "Analyze websites for consent banner compliance, cookie categorization, and GDPR dark pattern detection",
  metadataBase: new URL("https://consent-compass.vercel.app"),
  openGraph: {
    type: "website",
    siteName: "Consent Compass",
    title: "Consent Compass - Cookie Banner Compliance Scanner",
    description:
      "Analyze websites for consent banner compliance, cookie categorization, and GDPR dark pattern detection",
  },
  twitter: {
    card: "summary_large_image",
    title: "Consent Compass - Cookie Banner Compliance Scanner",
    description:
      "Analyze websites for consent banner compliance, cookie categorization, and GDPR dark pattern detection",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NuqsAdapter>
          <PostHogProvider>{children}</PostHogProvider>
        </NuqsAdapter>
            <Analytics />
      <SpeedInsights />
      </body>
    </html>
  );
}
