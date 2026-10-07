import { AppNav } from "@/components/bottom-nav";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <main className="mx-auto min-h-dvh w-full max-w-md bg-background pb-28">{children}</main>
      <AppNav />
    </>
  );
}
