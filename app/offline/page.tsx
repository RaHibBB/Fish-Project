import { WifiOff } from "lucide-react";
import { ReloadButton } from "@/components/reload-button";

export const metadata = { title: "ইন্টারনেট নেই" };

/** Shown by the service worker when the phone is offline. Static, so it can be cached. */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <WifiOff className="size-14 text-muted-foreground" />
      <h1 className="text-2xl font-bold">ইন্টারনেট নেই</h1>
      <p className="text-muted-foreground">
        হিসাব সবসময় সর্বশেষ অবস্থায় দেখাতে ইন্টারনেট লাগে। সংযোগ ফিরলে আবার চেষ্টা করুন — কিছু হারায়নি।
      </p>
      <ReloadButton />
    </main>
  );
}
