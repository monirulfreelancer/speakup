import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { InstallHint } from "@/components/pwa/install-hint";
import { Bot, Globe, Mic, Users } from "lucide-react";

/*
 * Public landing page. Server-rendered so it indexes: the copy, headings and
 * structured data are all in the initial HTML, and the only client component
 * is the small install hint (which needs browser APIs to know what to
 * suggest).
 */

const SITE_URL = env.NEXTAUTH_URL;
const TITLE = "SpeakUp: practise speaking English out loud";
const DESCRIPTION =
  "Practise spoken English with an AI partner any time, or get matched with a real learner at your level. Free to start, works in your browser.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "SpeakUp",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/icons/icon-512.png", width: 512, height: 512, alt: "SpeakUp" }],
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/icons/icon-512.png"],
  },
};

const FAQ = [
  {
    q: "Is SpeakUp free?",
    a: "Yes. You can create an account and start talking with the AI partner for free. There is a daily limit on practice minutes so the service stays available for everyone.",
  },
  {
    q: "Do I need a partner to practise?",
    a: "No. The AI partner is available at any hour, so you never have to wait for someone else to be online. Talking with a real person is there when you want it, but it is optional.",
  },
  {
    q: "What English level do I need?",
    a: "Any level from complete beginner (A1) to advanced (C2). You pick your level when you sign up, and the AI matches its vocabulary and sentence length to it. You can change your level later in settings.",
  },
  {
    q: "Do I need to install an app?",
    a: "No. SpeakUp runs in your browser. If you want it on your home screen, you can add it in a couple of taps and it opens like a normal app.",
  },
  {
    q: "What happens to my voice recordings?",
    a: "Your speech is turned into text so the app can reply and show you a transcript. Transcripts are stored in your own account and nobody else can read them. A conversation partner never sees your transcript.",
  },
];

export default async function LandingPage() {
  // Signed-in visitors have no use for marketing copy.
  const session = await auth();
  if (session?.user?.id) redirect("/dashboard");

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "SpeakUp",
      url: SITE_URL,
      description: DESCRIPTION,
      applicationCategory: "EducationalApplication",
      operatingSystem: "Any (web browser)",
      browserRequirements: "Requires a modern browser with microphone support",
      inLanguage: "en",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <div className="flex min-h-dvh flex-col">
        <header className="mx-auto flex w-full max-w-3xl items-center justify-between p-4">
          <span className="flex items-center gap-2 text-lg font-extrabold">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-on-primary">
              <Mic className="size-5" aria-hidden />
            </span>
            SpeakUp
          </span>
          <Link href="/login" className="text-sm font-medium underline underline-offset-4">
            Log in
          </Link>
        </header>

        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-12">
          {/* Hero */}
          <section className="space-y-5 py-10 text-center sm:py-16">
            <span className="mx-auto flex size-20 items-center justify-center rounded-3xl bg-primary text-on-primary">
              <Mic className="size-10" aria-hidden />
            </span>
            <h1 className="text-3xl sm:text-5xl">
              Get comfortable speaking English
            </h1>
            <p className="mx-auto max-w-xl text-lg text-muted">
              Practise out loud with an AI partner whenever you have ten minutes, or talk with a
              real learner at your level. No classroom, no schedule, no one judging you.
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="btn-3d flex min-h-14 items-center justify-center rounded-2xl bg-primary px-8 text-lg font-bold text-on-primary [--btn-edge:var(--primary-dark)] active:btn-3d-press"
              >
                Get started
              </Link>
              <Link
                href="/login"
                className="flex min-h-14 items-center justify-center rounded-2xl border-2 border-line bg-surface px-8 text-lg font-bold hover:bg-surface-raised"
              >
                Log in
              </Link>
            </div>
            <p className="text-sm text-muted">
              Free to start. Works in your browser, or{" "}
              <Link href="/download" className="font-bold text-primary underline underline-offset-4">
                put it on your phone
              </Link>
              .
            </p>
          </section>

          {/* Features */}
          <section className="space-y-4 py-8" aria-labelledby="features-heading">
            <h2 id="features-heading" className="text-center text-2xl">
              Why it works
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <article className="space-y-2 rounded-2xl border-2 border-line bg-surface p-5">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-surface-raised text-primary">
                  <Bot className="size-6" aria-hidden />
                </span>
                <h3 className="font-extrabold">An AI partner, any time</h3>
                <p className="text-sm text-muted">
                  Practise at midnight or on your bus ride. The AI keeps its sentences short at
                  beginner levels and stretches you as you improve, and it always asks a question
                  back so the conversation keeps going.
                </p>
              </article>
              <article className="space-y-2 rounded-2xl border-2 border-line bg-surface p-5">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-surface-raised text-primary">
                  <Users className="size-6" aria-hidden />
                </span>
                <h3 className="font-extrabold">Real people at your level</h3>
                <p className="text-sm text-muted">
                  When you want the real thing, we match you with another learner at your level or
                  one step away. Everyone there is practising too, so nobody minds the pauses and
                  mistakes.
                </p>
              </article>
              <article className="space-y-2 rounded-2xl border-2 border-line bg-surface p-5">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-surface-raised text-primary">
                  <Globe className="size-6" aria-hidden />
                </span>
                <h3 className="font-extrabold">English only, gently</h3>
                <p className="text-sm text-muted">
                  It is easy to slip back into your own language and lose the practice. SpeakUp
                  notices and nudges you back, softly at lower levels and firmly at higher ones.
                  You choose which.
                </p>
              </article>
            </div>
          </section>

          {/* How it works */}
          <section className="space-y-4 py-8" aria-labelledby="how-heading">
            <h2 id="how-heading" className="text-center text-2xl">
              How it works
            </h2>
            <ol className="grid gap-3 sm:grid-cols-3">
              <li className="rounded-2xl border-2 border-line bg-surface p-5">
                <p className="text-sm font-bold text-muted">Step 1</p>
                <p className="font-medium">Pick your level</p>
                <p className="text-sm text-muted">
                  Beginner to advanced. Not sure? Start at B1 and change it later.
                </p>
              </li>
              <li className="rounded-2xl border-2 border-line bg-surface p-5">
                <p className="text-sm font-bold text-muted">Step 2</p>
                <p className="font-medium">Choose a topic</p>
                <p className="text-sm text-muted">
                  Travel, food, job interviews, or just free talk about your day.
                </p>
              </li>
              <li className="rounded-2xl border-2 border-line bg-surface p-5">
                <p className="text-sm font-bold text-muted">Step 3</p>
                <p className="font-medium">Start talking</p>
                <p className="text-sm text-muted">
                  Tap the microphone and speak. That is the whole thing.
                </p>
              </li>
            </ol>
          </section>

          {/* Install hint (client component: needs to know the device) */}
          <InstallHint />

          {/* FAQ */}
          <section className="space-y-4 py-8" aria-labelledby="faq-heading">
            <h2 id="faq-heading" className="text-center text-2xl">
              Common questions
            </h2>
            <dl className="space-y-3">
              {FAQ.map((item) => (
                <div key={item.q} className="rounded-2xl border-2 border-line bg-surface p-5">
                  <dt className="font-extrabold">{item.q}</dt>
                  <dd className="pt-1 text-sm text-muted">{item.a}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="rounded-3xl bg-primary p-8 text-center text-on-primary">
            <h2 className="text-2xl">Ready to say something?</h2>
            <p className="pt-2 opacity-80">Your first conversation takes about five minutes.</p>
            <Link
              href="/signup"
              className="mt-4 inline-flex h-12 items-center justify-center rounded-lg bg-background px-6 font-medium text-foreground hover:opacity-90"
            >
              Get started
            </Link>
          </section>
        </main>

        <footer className="border-t">
          <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 p-4 text-sm text-muted">
            <span>© {new Date().getFullYear()} SpeakUp</span>
            <nav className="flex gap-4">
              <Link href="/download" className="underline underline-offset-4">
                Android app
              </Link>
              <Link href="/guidelines" className="underline underline-offset-4">
                Community guidelines
              </Link>
              <Link href="/privacy" className="underline underline-offset-4">
                Privacy
              </Link>
            </nav>
          </div>
        </footer>
      </div>
    </>
  );
}
