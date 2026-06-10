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

function getMetadataBaseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

export const metadata: Metadata = {
  applicationName: "CoachOS",
  metadataBase: new URL(getMetadataBaseUrl()),
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
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "CoachOS institute operations dashboard",
      },
    ],
    siteName: "CoachOS",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CoachOS",
    description:
      "CoachOS helps coaching institutes manage branches, students, batches, attendance, fees, and staff from one secure dashboard.",
    images: ["/opengraph-image"],
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
