import { Suspense } from "react";
import { FeedingForm } from "@/components/feeding-form";
import { PageHeader } from "@/components/page-header";
import { requirePartner } from "@/lib/server/auth";
import { getFeedings, getPonds } from "@/lib/server/queries";

async function NewFeeding() {
  await requirePartner();
  const [ponds, rows] = await Promise.all([getPonds(), getFeedings()]);
  const feedTypes = [...new Set(rows.map((r) => r.feedType).filter(Boolean))].slice(0, 15);
  return <FeedingForm ponds={ponds} feedTypes={feedTypes} />;
}

export default function NewFeedingPage() {
  return (
    <>
      <PageHeader title="খাবার দেওয়া" back="/feeding" />
      <Suspense fallback={<p className="p-4 text-muted-foreground">…</p>}>
        <NewFeeding />
      </Suspense>
    </>
  );
}
