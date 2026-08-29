import Link from "next/link";
import { Mic } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Log in — SpeakUp" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const { callbackUrl } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-on-primary">
            <Mic className="size-7" aria-hidden />
          </span>
          <h1 className="text-2xl">Welcome back</h1>
          <p className="text-sm text-muted">Log in to keep practicing.</p>
        </div>
        <LoginForm callbackUrl={callbackUrl} />
        <p className="text-center text-sm text-muted">
          New to SpeakUp?{" "}
          <Link href="/signup" className="font-medium text-foreground underline">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
