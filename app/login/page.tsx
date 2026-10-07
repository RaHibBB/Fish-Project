import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/auth-forms";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center bg-background px-5 py-10">
      <div className="mb-8 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" className="mx-auto mb-4 size-16" />
        <h1 className="text-2xl font-bold">চৌধুরী ব্রাদার্স এগ্রো</h1>
        <p className="text-muted-foreground">খরচ বা জমা লিখতে লগ ইন করুন</p>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
      <Link href="/" className="mt-6 text-center text-primary">
        লগ ইন ছাড়া হিসাব দেখুন →
      </Link>
    </main>
  );
}
