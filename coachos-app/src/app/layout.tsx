import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: "CoachOS",
  title: {
    default: "CoachOS",
    template: "%s | CoachOS",
  },
  description:
    "CoachOS helps coaching institutes manage branches, students, batches, attendance, fees, and staff from one secure dashboard.",
  openGraph: {
    title: "CoachOS",
    description:
      "CoachOS helps coaching institutes manage branches, students, batches, attendance, fees, and staff from one secure dashboard.",
    siteName: "CoachOS",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CoachOS",
    description:
      "CoachOS helps coaching institutes manage branches, students, batches, attendance, fees, and staff from one secure dashboard.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
