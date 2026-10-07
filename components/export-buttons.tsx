import { FileDown, Printer } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** PDF opens a print page (browser renders Bengali correctly); CSV downloads UTF-8 with BOM. */
export function ExportButtons({ pdf, csv, csvLabel = "Excel/CSV" }: { pdf: string; csv: string; csvLabel?: string }) {
  return (
    <div className="no-print flex gap-2">
      <a href={pdf} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "outline" }), "h-11 flex-1 text-base")}>
        <Printer className="size-4" /> PDF
      </a>
      <a href={csv} download className={cn(buttonVariants({ variant: "outline" }), "h-11 flex-1 text-base")}>
        <FileDown className="size-4" /> {csvLabel}
      </a>
    </div>
  );
}
