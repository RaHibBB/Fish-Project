import { Suspense } from "react";
import { getSettings } from "@/lib/server/queries";
import { bnDateTime } from "@/lib/format";
import { connection } from "next/server";

async function PrintHeader() {
  await connection();
  const settings = await getSettings();
  return (
    <header className="mb-4 border-b pb-2">
      <div className="text-xl font-bold">{settings.farmName}</div>
      <div className="text-xs text-muted-foreground">প্রিন্ট: {bnDateTime(new Date())}</div>
    </header>
  );
}

/** A4 print pages without app chrome. Each page renders <AutoPrint /> once its data is in. */
export default function PrintLayout({ children }: LayoutProps<"/print">) {
  return (
    <main className="mx-auto min-h-dvh max-w-3xl bg-white p-4 text-black print:max-w-none print:p-0">
      <Suspense>
        <PrintHeader />
      </Suspense>
      {children}
    </main>
  );
}
