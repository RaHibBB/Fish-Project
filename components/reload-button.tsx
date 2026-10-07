"use client";

import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReloadButton() {
  return (
    <Button className="h-12 px-6 text-base" onClick={() => location.reload()}>
      <RotateCw className="size-5" /> আবার চেষ্টা করুন
    </Button>
  );
}
