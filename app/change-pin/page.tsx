import { Suspense } from "react";
import Link from "next/link";
import { ChangePinForm } from "@/components/auth-forms";
import { requirePartner } from "@/lib/server/auth";

async function Greeting() {
  const partner = await requirePartner({ allowPinChange: true });
  return (
    <>
      <p className="text-muted-foreground">
        {partner.name}, {partner.mustChangePin ? "প্রথমবার ঢোকার আগে নিজের একটি নতুন পিন ঠিক করুন।" : "নতুন পিন ঠিক করুন।"}
      </p>
      {!partner.mustChangePin && (
        <Link href="/settings" className="mt-2 inline-block text-sm text-primary">
          ← সেটিংসে ফিরে যান
        </Link>
      )}
    </>
  );
}

export default function ChangePinPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center bg-background px-5 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">পিন বদলান</h1>
        <Suspense fallback={<p className="text-muted-foreground">…</p>}>
          <Greeting />
        </Suspense>
      </div>
      <ChangePinForm />
    </main>
  );
}
