import Link from "next/link";
import { Mic } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Sign up — SpeakUp" };

export default async function SignupPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-on-primary">
            <Mic className="size-7" aria-hidden />
          </span>
          <h1 className="text-2xl">Create your account</h1>
          <p className="text-sm text-muted">
            Start practicing spoken English today.
          </p>
        </div>
        <SignupForm />
        <p className="text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
