"use client";

import { useRef } from "react";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { compressImage } from "@/lib/client/compress-image";
import { toBnDigits } from "@/lib/format";

/**
 * Optional receipt photo: take or pick one, it is shrunk to ~200 KB on the phone.
 * `keep` = the entry already has a photo (when editing) that stays unless removed or replaced.
 */
export function ReceiptField({
  file,
  keep,
  onFile,
  onKeep,
  onError,
  label = "রসিদের ছবি (ইচ্ছা হলে)",
}: {
  file: File | null;
  keep: boolean;
  onFile: (f: File | null) => void;
  onKeep: (keep: boolean) => void;
  onError: (message: string | null) => void;
  label?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  async function pick(picked: File | undefined) {
    if (!picked) return;
    onError(null);
    try {
      onFile(await compressImage(picked));
    } catch {
      onError("ছবিটি ছোট করা গেল না, অন্য ছবি দিন।");
    }
  }

  return (
    <section className="space-y-2">
      <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      {file || keep ? (
        <div className="flex items-center gap-3 rounded-xl border p-3">
          <Camera className="size-5 text-primary" />
          <span className="flex-1 text-sm">{file ? `রসিদের ছবি (${toBnDigits(Math.round(file.size / 1024))} KB)` : "রসিদের ছবি আছে"}</span>
          <button
            type="button"
            aria-label="ছবি সরান"
            onClick={() => {
              onFile(null);
              onKeep(false);
              if (ref.current) ref.current.value = "";
            }}
            className="flex size-9 items-center justify-center rounded-full active:bg-muted"
          >
            <X className="size-5" />
          </button>
        </div>
      ) : (
        <Button type="button" variant="outline" className="h-12 w-full text-base" onClick={() => ref.current?.click()}>
          <Camera className="size-5" /> {label}
        </Button>
      )}
    </section>
  );
}
