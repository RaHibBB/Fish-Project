import { AppNav } from "@/components/bottom-nav";
import { OutboxBanner } from "@/components/outbox-banner";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <main className="mx-auto min-h-dvh w-full max-w-md bg-background pb-28">
        <OutboxBanner />
        {children}
      </main>
      <AppNav />
    </>
  );
}
