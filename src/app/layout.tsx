import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SwRegister } from "@/components/pwa/sw-register";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SpeakUp — English Speaking Practice",
  description: "Practice speaking English with an AI partner — or a real person.",
  // Apple has no manifest support worth speaking of; these emit the
  // apple-mobile-web-app meta tags plus the touch icon, so Add to Home
  // Screen on iPhone gets a proper name, icon and standalone chrome.
  appleWebApp: {
    capable: true,
    title: "SpeakUp",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
  other: {
    // Next 16 emits only the modern `mobile-web-app-capable`. iOS before
    // 15.4 reads the apple-prefixed tag instead, and without it those
    // iPhones open the home-screen shortcut in a plain Safari tab rather
    // than standalone. Cheap to keep, and this app targets older phones.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#171717",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SwRegister />
        {children}
      </body>
    </html>
  );
}
