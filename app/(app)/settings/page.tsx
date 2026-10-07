import { Suspense } from "react";
import Link from "next/link";
import { asc } from "drizzle-orm";
import { KeyRound, LogOut } from "lucide-react";
import { logoutAction } from "@/app/login/actions";
import { PageHeader } from "@/components/page-header";
import { CategoriesForm, FarmSettingsForm, PartnersForm } from "@/components/settings-forms";
import { Button, buttonVariants } from "@/components/ui/button";
import { db } from "@/lib/db";
import { partners } from "@/lib/db/schema";
import { requirePartner } from "@/lib/server/auth";
import { getCategories, getSettings } from "@/lib/server/queries";
import { cn } from "@/lib/utils";

async function SettingsContent() {
  const me = await requirePartner();
  const [settings, categories, partnerRows] = await Promise.all([
    getSettings(),
    getCategories(),
    db
      .select({ id: partners.id, name: partners.name, phone: partners.phone, shareBp: partners.shareBp })
      .from(partners)
      .orderBy(asc(partners.sortOrder), asc(partners.id)),
  ]);
  return (
    <div className="space-y-4 p-4">
      <p className="text-sm text-muted-foreground">আপনি ঢুকেছেন: {me.name}</p>
      <FarmSettingsForm initial={settings} />
      <PartnersForm initial={partnerRows} />
      <CategoriesForm categories={categories} />
      <section className="space-y-2 rounded-xl border p-4">
        <Link href="/change-pin" className={cn(buttonVariants({ variant: "outline" }), "h-12 w-full text-base")}>
          <KeyRound className="size-5" /> পিন বদলান
        </Link>
        <form action={logoutAction}>
          <Button type="submit" variant="ghost" className="h-12 w-full text-base text-destructive">
            <LogOut className="size-5" /> বের হন
          </Button>
        </form>
      </section>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="সেটিংস" back="/" />
      <Suspense fallback={<p className="p-4 text-muted-foreground">…</p>}>
        <SettingsContent />
      </Suspense>
    </>
  );
}
