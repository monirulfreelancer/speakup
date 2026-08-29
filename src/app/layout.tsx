import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import { SwRegister } from "@/components/pwa/sw-register";
import { ThemeProvider } from "@/components/theme-provider";

/*
 * Nunito: rounded and friendly, which is the whole visual brief. Loaded
 * through next/font so it is self-hosted (no third-party request, no
 * layout shift while it downloads).
 */
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SpeakUp — English Speaking Practice",
  description: "Practice speaking English with an AI partner — or a real person.",
  appleWebApp: {
    capable: true,
    title: "SpeakUp",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/icons/icon-180.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f9fc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1620" },
  ],
  // The call screen and bottom tabs sit against the phone's edges.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: next-themes sets the class on <html> before
    // React hydrates, which is exactly what prevents the wrong-theme flash.
    <html lang="en" className={`${nunito.variable} h-full`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col bg-background text-text">
        <ThemeProvider>
          <SwRegister />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
