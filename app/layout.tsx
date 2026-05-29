import type { Metadata } from "next";
import { Geist, Geist_Mono, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const BASE_URL = "https://claudinho.xyz";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Claudinho — skills, built by the community",
    template: "%s — Claudinho",
  },
  description:
    "Skills built and shared by the Claude community. Every skill is installed, run on a real input, and re-verified weekly — the output you see is the output you get.",
  openGraph: {
    type: "website",
    url: BASE_URL,
    siteName: "Claudinho",
    title: "Claudinho — skills, built by the community",
    description:
      "Skills built and shared by the Claude community. Every skill is installed, run on a real input, and re-verified weekly.",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Claudinho — skills, built by the community",
    description:
      "Skills built and shared by the Claude community. Every skill is installed, run on a real input, and re-verified weekly.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
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
      className={`${geistSans.variable} ${geistMono.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
